import { screen, waitFor } from '@testing-library/react-native';
import RevisaoDeCobranca from '../../../app/(tabs)/dividas/[id]/revisao';
import { ValorJustoCard } from '../../components/cards/ValorJustoCard';
import { ApiError } from '../../api/client';
import type { Achado } from '../../api/types';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { renderizarTela } from '../render';

const achadoComValor = (over: Partial<Achado> = {}): Achado => ({
  id: 'multa_acima_do_teto',
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
    script: 'Olá. Sou cliente e gostaria de rever alguns pontos do meu contrato.',
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

  it('sem achado, convida a enviar o contrato em vez de dizer que está tudo certo', async () => {
    // O vazio é o estado mais importante: "nada encontrado" soaria como
    // "conferimos e está tudo certo", que é o que NÃO podemos afirmar.
    responderPorRota({ '/v1/dividas/': revisao({ achados: [], valorJusto: null, script: null }) });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getByText('Ainda não dá para conferir esta cobrança')).toBeTruthy(),
    );
    expect(screen.getByText('Enviar contrato')).toBeTruthy();
    expect(screen.queryByText(/tudo certo/i)).toBeNull();
  });

  it('lista o achado com valor, fonte e o trecho do contrato', async () => {
    responderPorRota({ '/v1/dividas/': revisao() });
    renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getByText('Multa de atraso acima do limite do CDC')).toBeTruthy(),
    );
    expect(screen.getByText('Código de Defesa do Consumidor, art. 52, §1º')).toBeTruthy();
    expect(screen.getByText('Multa por atraso: 5% sobre o valor da parcela')).toBeTruthy();
    // Duas ocorrências, e é o esperado: o valor do único achado E a economia
    // total coincidem quando só há um achado com valor.
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
    // O valor cobrado não vira "valor justo" por descuido.
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

    await waitFor(() => expect(screen.getByText('Mensagem para o credor')).toBeTruthy());
    expect(screen.getByText(/ajuste com suas palavras e envie você mesmo/)).toBeTruthy();
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

describe('postura da copy (guardrail 3)', () => {
  // Gêmeo do teste que quebra em "recomendada" no simulador. Achado é convite a
  // investigar; se alguém escrever uma sentença aqui, isto falha.
  const PROIBIDO = /ilegal|abusiv|é seu direito|você tem direito|com certeza|garantid[ao]/i;

  it('nenhum texto da tela afirma ilegalidade', async () => {
    responderPorRota({
      '/v1/dividas/': revisao({ achados: [achadoComValor(), achadoSemValor()] }),
    });
    const { toJSON } = renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getByText('Multa de atraso acima do limite do CDC')).toBeTruthy(),
    );
    expect(JSON.stringify(toJSON())).not.toMatch(PROIBIDO);
  });

  it('o estado vazio não afirma que a cobrança está correta', async () => {
    responderPorRota({ '/v1/dividas/': revisao({ achados: [], valorJusto: null, script: null }) });
    const { toJSON } = renderizarTela(<RevisaoDeCobranca />);

    await waitFor(() =>
      expect(screen.getByText('Ainda não dá para conferir esta cobrança')).toBeTruthy(),
    );
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
          script: 'Olá.',
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
