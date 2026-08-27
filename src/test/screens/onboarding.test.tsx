import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import EscolhaDaDivida from '../../../app/(onboarding)/divida';
import EntradaDaDivida from '../../../app/(onboarding)/entrada';
import { escolherArquivo } from '../../components/ui/SeletorDeArquivo';
import type { ExtracaoContrato } from '../../api/contratos';
import { limparMocksDeRede, requestMock, uploadMock } from '../api';
import { umaExtracao } from '../mocks';
import { renderizarTela } from '../render';
import { dateParaIso } from '../../util/date';

// O seletor de arquivo é nativo; sob jest ele não existe. O que os testes
// verificam é o que a fila FAZ com o arquivo escolhido, não o menu do sistema.
jest.mock('../../components/ui/SeletorDeArquivo', () => ({ escolherArquivo: jest.fn() }));
const escolherArquivoMock = escolherArquivo as jest.MockedFunction<typeof escolherArquivo>;

afterEach(limparMocksDeRede);
afterEach(() => escolherArquivoMock.mockReset());

const UM_ARQUIVO = { uri: 'file://contrato.pdf', nome: 'contrato.pdf', mimeType: 'application/pdf' };

/**
 * Prepara o caminho do documento inline na fila: o seletor devolve um arquivo, o
 * upload devolve uma extração em processamento, o polling devolve a extração
 * pronta, e o POST de dívida devolve ids em sequência.
 */
function mockFluxoDocumento(extracao: ExtracaoContrato = umaExtracao()) {
  let i = 0;
  escolherArquivoMock.mockResolvedValue(UM_ARQUIVO);
  uploadMock.mockResolvedValue({
    extracao: { id: extracao.id, status: 'processando', tipo: 'contrato' },
  } as never);
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith('/v1/contratos/')) return Promise.resolve({ extracao }) as never;
    if (path === '/v1/dividas') {
      return Promise.resolve({ divida: { id: `divida-${i++}` } }) as never;
    }
    return Promise.reject(new Error(`rota inesperada no teste: ${path}`)) as never;
  });
}

/** As chamadas de POST /v1/dividas, na ordem em que saíram. */
function criacoes(): Record<string, unknown>[] {
  return requestMock.mock.calls
    .filter((c) => c[0] === '/v1/dividas' && (c[1] as { method?: string })?.method === 'POST')
    .map((c) => (c[1] as { body: Record<string, unknown> }).body);
}

const CARTAO = 'Cartão de crédito / rotativo';
const EMPRESTIMO = 'Empréstimo ou consignado';

function tocar(nome: string | RegExp) {
  fireEvent.press(screen.getByText(nome));
}

function preencher(rotulo: string, valor: string) {
  fireEvent.changeText(screen.getByLabelText(rotulo), valor);
}

/** Abre o seletor "Quando começou?" e confirma uma data — como o picker nativo faria. */
function escolherData(quando: Date) {
  fireEvent.press(screen.getByLabelText('Quando começou?'));
  fireEvent(screen.UNSAFE_getByType(DateTimePicker), 'change', { type: 'set' }, quando);
}

/** O corpo do POST /v1/dividas da n-ésima criação. */
function corpoDaCriacao(n: number): Record<string, unknown> {
  const chamada = requestMock.mock.calls[n];
  return (chamada?.[1] as { body: Record<string, unknown> }).body;
}

/** Uma dívida criada por vez, com id previsível, na ordem das chamadas. */
function criaDividasEmSequencia(ids: string[]) {
  let i = 0;
  requestMock.mockImplementation(() =>
    Promise.resolve({ divida: { id: ids[i++] ?? 'extra' } }) as never,
  );
}

describe('passo 1 — qual dívida tira seu sono', () => {
  /**
   * A MUDANÇA DA ADR 0016. A concepção pedia uma dívida por vez ("Começa por uma
   * só"), e a carteira real não é assim: cartão E empréstimo é o caso comum.
   * Quem marcava cartão terminava o onboarding sem caminho óbvio para a segunda.
   */
  it('aceita mais de uma dívida marcada', () => {
    renderizarTela(<EscolhaDaDivida />);

    tocar(CARTAO);
    tocar(EMPRESTIMO);

    for (const rotulo of [CARTAO, EMPRESTIMO]) {
      const linha = screen.getByText(rotulo).parent;
      expect(linha).toBeTruthy();
    }
    // O rótulo do CTA conta quantas — é o que confirma que as duas entraram.
    expect(screen.getByText('Continuar com 2 dívidas')).toBeTruthy();
  });

  it('desmarcar tira da fila', () => {
    renderizarTela(<EscolhaDaDivida />);

    tocar(CARTAO);
    tocar(EMPRESTIMO);
    tocar(EMPRESTIMO);

    expect(screen.getByText('Continuar')).toBeTruthy();
  });

  it('não avança sem nada marcado', () => {
    renderizarTela(<EscolhaDaDivida />);

    fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(global.mockRouter.push).not.toHaveBeenCalled();
  });

  // A ORDEM DA MARCAÇÃO É A ORDEM DA FILA, e ela decide qual dívida recebe a
  // triagem no fim: quem marca primeiro marca o que dói mais.
  it('leva a fila na ordem em que foi marcada', () => {
    renderizarTela(<EscolhaDaDivida />);

    tocar(EMPRESTIMO);
    tocar(CARTAO);
    fireEvent.press(screen.getByRole('button', { name: 'Continuar com 2 dívidas' }));

    expect(global.mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/entrada',
      params: { fila: 'emprestimo,cartao' },
    });
  });
});

describe('passo 2 — uma dívida marcada', () => {
  beforeEach(() => global.definirParametrosDeRota({ fila: 'cartao' }));

  /**
   * O DOCUMENTO CONTINUA VINDO PRIMEIRO quando há uma dívida só, e isso não é
   * estética: só contrato lido produz achado, e sem achado não há valor justo nem
   * script. Este teste falha se a variante de fila engolir a de uma dívida.
   */
  it('oferece o documento antes do cadastro manual', () => {
    renderizarTela(<EntradaDaDivida />);

    expect(screen.getByText('Mandar a fatura ou o contrato')).toBeTruthy();
    expect(screen.getByText('Só sei o valor')).toBeTruthy();
  });
});

describe('passo 2 — a fila', () => {
  beforeEach(() => global.definirParametrosDeRota({ fila: 'cartao,emprestimo' }));

  it('mostra em qual dívida da fila está', () => {
    renderizarTela(<EntradaDaDivida />);
    expect(screen.getByText(/1 de 2/)).toBeTruthy();
  });

  // A REVERSÃO DA ADR 0016 PONTO 5 (ADR 0022). O upload agora aparece na fila,
  // OPCIONAL por dívida — mas lido INLINE, sem o `router.push` para
  // `/dividas/contrato` que abandonaria o resto da fila. O botão que sai do grupo
  // continua ausente; o que aparece é o de leitura inline.
  it('oferece o documento inline na fila, sem sair do grupo (onboarding)', () => {
    renderizarTela(<EntradaDaDivida />);
    expect(screen.getByText('Mandar o documento')).toBeTruthy();
    // O botão da variante de UMA dívida — que empurra para fora — não aparece.
    expect(screen.queryByText('Mandar a fatura ou o contrato')).toBeNull();
    // E o aviso de descarte está à vista ANTES do toque (guardrail 8.3).
    expect(screen.getByText(/lê o arquivo e/)).toBeTruthy();
  });

  it('avança para a segunda dívida com os campos limpos', async () => {
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');

    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    expect(screen.getByLabelText('Pra quem você deve').props.value).toBe('');
    // NADA FOI GRAVADO AINDA: a fila inteira sai num POST só, no fim, para o
    // botão de voltar não produzir dívida duplicada.
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('não avança com campo vazio', () => {
    renderizarTela(<EntradaDaDivida />);

    tocar('Continuar');

    expect(screen.getByText('Diz pra quem você deve.')).toBeTruthy();
    expect(screen.getByText(/1 de 2/)).toBeTruthy();
  });

  it('grava as duas e manda a triagem para a primeira marcada', async () => {
    criaDividasEmSequencia(['divida-cartao', 'divida-emprestimo']);
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');

    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() =>
      expect(global.mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/(onboarding)/triagem',
        params: { id: 'divida-cartao', total: '2' },
      }),
    );
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  // A DATA DE ORIGEM VEM PRÉ-PREENCHIDA COM HOJE. Quem não sabe a data de cabeça
  // só confirma, e a fila não trava por isso.
  it('grava com a data de hoje quando a pessoa não ajusta', async () => {
    criaDividasEmSequencia(['divida-cartao', 'divida-emprestimo']);
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');
    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    expect(corpoDaCriacao(0).dataOrigem).toBe(dateParaIso(new Date()));
  });

  // ...MAS QUANDO ELA AJUSTA, é a data dela que vai — não mais "hoje" cravado.
  // A prescrição (CC art. 206) conta a partir daqui, então isso muda o cálculo.
  it('grava a data que a pessoa escolheu, não hoje', async () => {
    criaDividasEmSequencia(['divida-cartao', 'divida-emprestimo']);
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    escolherData(new Date(2021, 5, 15));
    tocar('Continuar');
    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    expect(corpoDaCriacao(0).dataOrigem).toBe('2021-06-15');
    // A segunda, intocada, segue com hoje: a data de uma não contamina a outra.
    expect(corpoDaCriacao(1).dataOrigem).toBe(dateParaIso(new Date()));
  });

  /**
   * A rede caindo no MEIO da fila. Nada é desfeito — as dívidas criadas são
   * reais —, e o teste garante que a pessoa não fica presa no formulário: ou
   * tenta de novo (e a segunda tentativa não duplica a primeira), ou vai ver o
   * que já cadastrou.
   */
  it('falha no meio: oferece ver o que já foi cadastrado, e o retry não duplica', async () => {
    let chamadas = 0;
    requestMock.mockImplementation(() => {
      chamadas += 1;
      return chamadas === 2
        ? Promise.reject(new Error('sem rede'))
        : (Promise.resolve({ divida: { id: `divida-${chamadas}` } }) as never);
    });
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');
    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() =>
      expect(screen.getByText('Ver a dívida que já cadastrei')).toBeTruthy(),
    );
    expect(global.mockRouter.replace).not.toHaveBeenCalled();

    // A nova tentativa pula a primeira, que já existe: 3 chamadas no total, não 4.
    tocar('Cadastrar as 2 dívidas');
    await waitFor(() =>
      expect(global.mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/(onboarding)/triagem',
        params: { id: 'divida-1', total: '2' },
      }),
    );
    expect(chamadas).toBe(3);
  });

  describe('voltar', () => {
    it('recua na fila preservando o que foi digitado', async () => {
      renderizarTela(<EntradaDaDivida />);

      preencher('Pra quem você deve', 'Nubank');
      preencher('Quanto estão cobrando', '987000');
      tocar('Continuar');
      await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());

      fireEvent.press(screen.getByLabelText('Voltar'));

      await waitFor(() => expect(screen.getByText(/1 de 2/)).toBeTruthy());
      expect(screen.getByLabelText('Pra quem você deve').props.value).toBe('Nubank');
    });

    it('no começo da fila sai para o passo 1', () => {
      renderizarTela(<EntradaDaDivida />);

      fireEvent.press(screen.getByLabelText('Voltar'));

      expect(global.mockRouter.back).toHaveBeenCalled();
    });
  });
});

describe('passo 2 — documento inline na fila (ADR 0022)', () => {
  beforeEach(() => global.definirParametrosDeRota({ fila: 'cartao,emprestimo' }));

  // A REVISÃO CAMPO-A-COMPO COM O TRECHO À VISTA, antes de a dívida entrar na
  // fila. É o guardrail 8.1 honrado inline: não bastam os dois campos, tem de
  // mostrar de onde cada valor veio.
  it('mostra a revisão com o trecho do documento antes de aceitar', async () => {
    mockFluxoDocumento();
    renderizarTela(<EntradaDaDivida />);

    fireEvent.press(screen.getByText('Mandar o documento'));

    await waitFor(() => expect(screen.getByText('Usar estes dados')).toBeTruthy());
    // O trecho literal aparece, como texto puro (guardrail 8.2).
    expect(screen.getByText('CREDOR: Banco Teste S/A')).toBeTruthy();
    expect(screen.getByText('Valor total: R$ 1.500,00')).toBeTruthy();
  });

  // O "aha" que a ADR 0022 devolve à fila: a dívida com documento nasce LIGADA à
  // extração (extracaoId no POST), e é isso que faz a triagem dela ter achado.
  it('lê o documento, pré-preenche e liga o extracaoId; a sem documento segue por valor', async () => {
    mockFluxoDocumento();
    renderizarTela(<EntradaDaDivida />);

    // Dívida 1 (cartão): pelo documento.
    fireEvent.press(screen.getByText('Mandar o documento'));
    await waitFor(() => expect(screen.getByText('Usar estes dados')).toBeTruthy());
    fireEvent.press(screen.getByText('Usar estes dados'));

    // De volta ao formulário, já preenchido com o que foi lido.
    await waitFor(() =>
      expect(screen.getByLabelText('Pra quem você deve').props.value).toBe('Banco Teste S/A'),
    );
    tocar('Continuar');

    // Dívida 2 (empréstimo): só pelo valor.
    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() => expect(criacoes()).toHaveLength(2));
    const [primeira, segunda] = criacoes();
    // A do documento carrega o vínculo; a do valor, não.
    expect(primeira!.extracaoId).toBe('extracao-1');
    expect(primeira!.credor).toBe('Banco Teste S/A');
    expect(segunda!.extracaoId).toBeUndefined();
    expect(segunda!.credor).toBe('Banco do Brasil');
  });

  // O INVARIANTE QUE NÃO PODE QUEBRAR (ADR 0016 ponto 4, preservado na 0022): a
  // extração grava linha `extracao`, nunca `divida`. Nada é `divida` antes do
  // `enviarTudo()` — nem com documento lido e confirmado.
  it('não grava nenhuma dívida antes do fim, mesmo com documento lido e aceito', async () => {
    mockFluxoDocumento();
    renderizarTela(<EntradaDaDivida />);

    fireEvent.press(screen.getByText('Mandar o documento'));
    await waitFor(() => expect(screen.getByText('Usar estes dados')).toBeTruthy());
    fireEvent.press(screen.getByText('Usar estes dados'));
    await waitFor(() =>
      expect(screen.getByLabelText('Pra quem você deve').props.value).toBe('Banco Teste S/A'),
    );

    // O upload da extração aconteceu (linha `extracao`)...
    expect(uploadMock).toHaveBeenCalledTimes(1);
    // ...mas NENHUM POST de dívida saiu ainda: nada é `divida` antes do fim.
    expect(criacoes()).toHaveLength(0);
  });

  it('descartar a leitura volta ao formulário sem gravar nada', async () => {
    mockFluxoDocumento();
    renderizarTela(<EntradaDaDivida />);

    fireEvent.press(screen.getByText('Mandar o documento'));
    await waitFor(() => expect(screen.getByText('Descartar e digitar')).toBeTruthy());
    fireEvent.press(screen.getByText('Descartar e digitar'));

    await waitFor(() => expect(screen.getByText(/1 de 2/)).toBeTruthy());
    expect(criacoes()).toHaveLength(0);
    // O campo continua vazio: descartar não preenche nada.
    expect(screen.getByLabelText('Pra quem você deve').props.value).toBe('');
  });

  // Extração que falhou não vira beco: a pessoa segue só pelo valor, e a fila não
  // trava. Os quatro estados existem inline (enviando/erro/vazio/lido).
  it('extração que falha oferece seguir só pelo valor', async () => {
    mockFluxoDocumento(umaExtracao({ status: 'falhou', erro: 'Imagem ilegível.', campos: undefined }));
    renderizarTela(<EntradaDaDivida />);

    fireEvent.press(screen.getByText('Mandar o documento'));

    await waitFor(() => expect(screen.getByText('Imagem ilegível.')).toBeTruthy());
    expect(screen.getByText('Seguir só pelo valor')).toBeTruthy();
    fireEvent.press(screen.getByText('Seguir só pelo valor'));
    await waitFor(() => expect(screen.getByLabelText('Pra quem você deve')).toBeTruthy());
  });
});

describe('passo 2 — uma dívida marcada não muda com a ADR 0022', () => {
  beforeEach(() => global.definirParametrosDeRota({ fila: 'cartao' }));

  // A variante de UMA dívida segue empurrando para a tela cheia de contrato — lá
  // ela escolhe o tipo de documento e tem o fluxo completo. O inline é a resposta
  // ao problema da FILA, que a de uma dívida não tem.
  it('continua com o documento como caminho primário, não o inline', () => {
    renderizarTela(<EntradaDaDivida />);
    expect(screen.getByText('Mandar a fatura ou o contrato')).toBeTruthy();
    expect(screen.queryByText('Mandar o documento')).toBeNull();
  });
});

describe('passo 2 — fila corrompida', () => {
  // Param de rota é entrada não confiável. Sem tela de erro dramática: a escolha
  // está a um toque.
  it('id desconhecido não vira dívida de tipo inventado', () => {
    global.definirParametrosDeRota({ fila: 'nao-existe' });
    renderizarTela(<EntradaDaDivida />);

    expect(screen.getByText('Não entendi qual dívida você escolheu.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher a dívida' })).toBeTruthy();
  });
});
