import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import RevisaoDeCobranca from '../../../app/(tabs)/dividas/[id]/revisao';
import { ValorJustoCard } from '../../components/cards/ValorJustoCard';
import { ApiError } from '../../api/client';
import type { Achado, BlocoScript, Canal, ScriptNegociacao } from '../../api/types';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { renderizarTela } from '../render';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

// A copy vem curada do backend; nos testes basta uma amostra fiel da FORMA
// (blocos tipados por canal) para exercitar a tela.
const ALERTA =
  'Confira o número ou o e-mail do credor no site oficial dele antes de continuar. ' +
  'Nunca negocie com um contato que procurou você primeiro.';
const REGRA = 'Pagamento só por boleto ou Pix em nome do credor — confira o CNPJ.';
const ARGUMENTO = 'Vale contestar a diferença (Código de Defesa do Consumidor, art. 52, §1º).';

function scriptEscrito(canal: Canal, { comAchado = true } = {}): ScriptNegociacao {
  const blocos: BlocoScript[] = [
    {
      id: 'alerta-validacao',
      titulo: 'Antes de negociar',
      texto: ALERTA,
      momento: 'abertura',
      copiavel: true,
    },
    {
      id: 'saudacao',
      titulo: null,
      texto: `Olá, sou cliente e quero revisar meu contrato pelo ${canal}.`,
      momento: 'abertura',
      copiavel: true,
    },
  ];
  if (comAchado) {
    blocos.push({
      id: 'argumento-multa',
      titulo: 'Multa de atraso acima do limite do CDC',
      texto: ARGUMENTO,
      momento: 'argumento',
      copiavel: true,
    });
  }
  blocos.push({
    id: 'pedido-demonstrativo',
    titulo: null,
    texto: 'Peço o demonstrativo detalhado do débito.',
    momento: 'fechamento',
    copiavel: true,
  });
  blocos.push({
    id: 'regra-pagamento',
    titulo: 'Como pagar',
    texto: REGRA,
    momento: 'fechamento',
    copiavel: true,
  });
  return { canal, blocos };
}

function scriptTelefone(): ScriptNegociacao {
  return {
    canal: 'telefone',
    blocos: [
      {
        id: 'saudacao',
        titulo: null,
        texto: 'Olá, sou cliente e quero revisar meu contrato pelo telefone.',
        momento: 'abertura',
        copiavel: false,
      },
      {
        id: 'argumento-multa',
        titulo: 'Multa de atraso acima do limite do CDC',
        texto: ARGUMENTO,
        momento: 'argumento',
        copiavel: false,
      },
    ],
  };
}

const achadoComValor = (over: Partial<Achado> = {}): Achado => ({
  id: 'multa_acima_do_teto',
  // Id REAL do registro de `juridico/fontes.py` (M14): é por ele que a tela
  // abre ementa, vigência e link da norma.
  fonteIds: ['cdc-52-1'],
  titulo: 'Multa de atraso acima do limite do CDC',
  explicacao:
    'O contrato prevê multa de 5% por atraso. O Código de Defesa do Consumidor limita a ' +
    'multa de mora a 2% do valor da prestação. Vale contestar a diferença.',
  fonte: 'Código de Defesa do Consumidor, art. 52, §1º',
  comoConferir: 'Procure no contrato a cláusula de multa por atraso e confira o percentual.',
  valorContestavel: 18000,
  evidencia: 'Multa por atraso: 5% sobre o valor da parcela',
  ...over,
});

const achadoSemValor = (): Achado =>
  achadoComValor({
    id: 'juros_acima_do_teto',
    titulo: 'Juros acima do teto do consignado',
    explicacao: 'A taxa contratada é de 25% ao mês. O teto vigente é de 1,85% ao mês.',
    fonte: 'Resolução do Conselho Nacional de Previdência Social (CNPS)',
    comoConferir: 'Confira a taxa de juros mensal no seu contrato.',
    valorContestavel: null,
    evidencia: null,
  });

const revisao = (over = {}) => ({
  revisao: {
    dividaId: 'divida-1',
    credor: 'Banco Teste S/A',
    valorCobrado: 150000,
    valorJusto: 132000,
    achados: [achadoComValor()],
    script: scriptEscrito('email'),
    fundamentos: ['Código de Defesa do Consumidor, art. 52, §1º'],
    baseLegalVigenteEm: null,
    ...over,
  },
});

beforeEach(() => global.definirParametrosDeRota({ id: 'divida-1' }));
afterEach(limparMocksDeRede);

describe('tela de revisão de cobrança', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<RevisaoDeCobranca />);
    expect(screen.getByText('Conferindo o contrato')).toBeTruthy();
  });

  it('mostra erro com retry', async () => {
    responderPorRota({ '/v1/dividas/': new ApiError(500, 'Erro 500.') });
    renderizarTela(<RevisaoDeCobranca />);
    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('T4-AC1: sem achado, EXIBE o script de segurança em vez de esconder tudo', async () => {
    // O critério que dá nome à tarefa. Quem cadastrou a dívida na mão é o alvo
    // preferencial do golpe, e é exatamente quem receberia tela vazia antes.
    responderPorRota({
      '/v1/dividas/': revisao({
        achados: [],
        valorJusto: null,
        script: scriptEscrito('email', { comAchado: false }),
      }),
    });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() => expect(screen.getByText(ALERTA)).toBeTruthy());
    // Alerta abre, regra de pagamento fecha — mesmo sem nenhum achado.
    expect(screen.getByText(REGRA)).toBeTruthy();
    // E não afirma que a cobrança está certa.
    expect(screen.queryByText(/tudo certo/i)).toBeNull();
  });

  it('lista o achado com valor, fonte e o trecho do contrato', async () => {
    responderPorRota({ '/v1/dividas/': revisao() });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getAllByText('Multa de atraso acima do limite do CDC').length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getByText('Código de Defesa do Consumidor, art. 52, §1º')).toBeTruthy();
    expect(screen.getByText('Multa por atraso: 5% sobre o valor da parcela')).toBeTruthy();
    expect(screen.getAllByText('R$ 180,00')).toHaveLength(2);
  });

  it('exibe o comparativo e a economia, que é a única subtração do cliente', async () => {
    responderPorRota({ '/v1/dividas/': revisao() });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() => expect(screen.getByText('R$ 1.500,00')).toBeTruthy());
    expect(screen.getByText('R$ 1.320,00')).toBeTruthy();
  });

  it('sem valorJusto, não inventa número e explica por quê', async () => {
    responderPorRota({
      '/v1/dividas/': revisao({ achados: [achadoSemValor()], valorJusto: null }),
    });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getByText('Juros acima do teto do consignado')).toBeTruthy(),
    );
    expect(screen.getByText(/não mostramos um número aqui/)).toBeTruthy();
    expect(screen.queryByText('Se acolherem os pontos')).toBeNull();
  });

  it('exibe a vigência do teto quando algum achado dependeu dele', async () => {
    responderPorRota({
      '/v1/dividas/': revisao({
        achados: [achadoSemValor()],
        valorJusto: null,
        baseLegalVigenteEm: '2025-03-25',
      }),
    });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getByText('Tetos de juros vigentes em 25/03/2025.')).toBeTruthy(),
    );
  });

  it('apresenta o script como sugestão editável, não como algo que o app envia', async () => {
    responderPorRota({ '/v1/dividas/': revisao() });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getByText(/ajuste com suas palavras e envie você mesmo/)).toBeTruthy(),
    );
  });

  it('carrega o disclaimer junto do número, não em rodapé solto', async () => {
    responderPorRota({ '/v1/dividas/': revisao() });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(
        screen.getByText('Estimativa educacional. Não é aconselhamento jurídico.'),
      ).toBeTruthy(),
    );
  });
});

describe('seletor de canal (T4-AC2)', () => {
  it('trocar de canal troca a variante, e voltar não devolve o texto anterior', async () => {
    responderPorRota({
      '/v1/dividas/divida-1/revisao?canal=email': revisao({ script: scriptEscrito('email') }),
      '/v1/dividas/divida-1/revisao?canal=chat': revisao({ script: scriptEscrito('chat') }),
      '/v1/dividas/divida-1/revisao?canal=telefone': revisao({ script: scriptTelefone() }),
    });
    renderizarTela(<RevisaoDeCobranca />);

    // Default é e-mail.
    await waitFor(() =>
      expect(screen.getByText(/quero revisar meu contrato pelo email\./)).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('Chat'));
    await waitFor(() =>
      expect(screen.getByText(/quero revisar meu contrato pelo chat\./)).toBeTruthy(),
    );
    // Sem chave por canal, o cache do e-mail voltaria aqui.
    expect(screen.queryByText(/pelo email\./)).toBeNull();

    fireEvent.press(screen.getByText('E-mail'));
    await waitFor(() =>
      expect(screen.getByText(/quero revisar meu contrato pelo email\./)).toBeTruthy(),
    );
  });
});

describe('copiar por bloco no canal escrito (T4-AC3 e T4-AC7)', () => {
  it('copiar um bloco copia só o texto dele, e o botão tem accessibilityLabel', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    responderPorRota({ '/v1/dividas/': revisao({ script: scriptEscrito('email') }) });
    renderizarTela(<RevisaoDeCobranca />);

    const botao = await screen.findByLabelText(
      'Copiar este bloco: Multa de atraso acima do limite do CDC',
    );
    fireEvent.press(botao);

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(ARGUMENTO);
    // Não copiou o alerta nem a regra junto.
    expect(Clipboard.setStringAsync).not.toHaveBeenCalledWith(ALERTA);
  });
});

describe('postura da copy (guardrail 3) — T4-AC5', () => {
  const PROIBIDO = /ilegal|abusiv|nul[ao]\b|é seu direito|você tem direito|com certeza|garantid[ao]/i;

  it.each<Canal>(['telefone', 'chat', 'email'])(
    'nenhum texto afirma ilegalidade no canal %s',
    async (canal) => {
      const script = canal === 'telefone' ? scriptTelefone() : scriptEscrito(canal);
      responderPorRota({
        '/v1/dividas/': revisao({ achados: [achadoComValor(), achadoSemValor()], script }),
      });
      const { toJSON } = renderizarTela(<RevisaoDeCobranca />);

      await waitFor(() =>
        expect(screen.getAllByText('Multa de atraso acima do limite do CDC').length).toBeGreaterThan(
          0,
        ),
      );
      expect(JSON.stringify(toJSON())).not.toMatch(PROIBIDO);
    },
  );

  it('o estado sem achado não afirma que a cobrança está correta', async () => {
    responderPorRota({
      '/v1/dividas/': revisao({
        achados: [],
        valorJusto: null,
        script: scriptEscrito('email', { comAchado: false }),
      }),
    });
    const { toJSON } = renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() => expect(screen.getByText(REGRA)).toBeTruthy());
    expect(JSON.stringify(toJSON())).not.toMatch(/tudo certo|nada de errado|sem problema/i);
  });
});

describe('card valor_justo no chat', () => {
  it('leva para a tela de revisão pelo campo tipado', () => {
    renderizarTela(
      <ValorJustoCard
        data={{
          kind: 'valor_justo',
          dividaId: 'divida-1',
          credor: 'Banco Teste S/A',
          valorCobrado: 150000,
          valorJusto: 132000,
          script: scriptEscrito('email'),
          fundamentos: ['Código de Defesa do Consumidor, art. 52, §1º'],
        }}
      />,
    );

    expect(screen.getByText('Ver ponto a ponto')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Ver ponto a ponto o que vale contestar na dívida com Banco Teste S/A',
      ),
    ).toBeTruthy();
  });
});
