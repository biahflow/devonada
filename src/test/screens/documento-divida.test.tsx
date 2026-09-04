import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import DocumentoDaDivida from '../../../app/(tabs)/dividas/[id]/documento';
import { escolherArquivo } from '../../components/ui/SeletorDeArquivo';
import { ApiError } from '../../api/client';
import type { ExtracaoContrato } from '../../api/contratos';
import type { Divida } from '../../api/types';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota, uploadMock } from '../api';
import { umaDivida, umaExtracao } from '../mocks';
import { renderizarTela } from '../render';

// O seletor é nativo; sob jest ele não existe. O que este arquivo verifica é o
// que a tela FAZ com o arquivo escolhido, não o menu do sistema.
jest.mock('../../components/ui/SeletorDeArquivo', () => ({ escolherArquivo: jest.fn() }));
const escolherArquivoMock = escolherArquivo as jest.MockedFunction<typeof escolherArquivo>;

const UM_ARQUIVO = { uri: 'file://contrato.pdf', nome: 'contrato.pdf', mimeType: 'application/pdf' };

beforeEach(() => global.definirParametrosDeRota({ id: 'divida-1' }));
afterEach(limparMocksDeRede);
afterEach(() => escolherArquivoMock.mockReset());

/**
 * O caminho inteiro: a dívida existe, o seletor devolve um arquivo, o upload
 * devolve uma extração em processamento, o polling devolve a leitura pronta, e
 * `POST /v1/dividas/{id}/documento` devolve a dívida já ligada.
 *
 * O roteamento é por implementação e não por `responderPorRota` porque duas
 * rotas começam com `/v1/dividas/` — o GET do detalhe e o POST do vínculo — e
 * confundi-las apagaria justamente o que estes testes provam.
 */
function mockFluxo({
  divida = umaDivida(),
  extracao = umaExtracao(),
}: { divida?: Divida; extracao?: ExtracaoContrato } = {}) {
  escolherArquivoMock.mockResolvedValue(UM_ARQUIVO);
  uploadMock.mockResolvedValue({
    extracao: { id: extracao.id, status: 'processando', tipo: extracao.tipo },
  } as never);
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith('/v1/contratos/')) return Promise.resolve({ extracao }) as never;
    if (path.endsWith('/documento')) {
      return Promise.resolve({ divida: { ...divida, extracaoId: extracao.id } }) as never;
    }
    if (path.startsWith('/v1/dividas/')) return Promise.resolve({ divida }) as never;
    return Promise.reject(new Error(`rota inesperada no teste: ${path}`)) as never;
  });
}

/** O corpo do POST que liga o documento à dívida, se ele chegou a sair. */
function corpoDoVinculo(): Record<string, unknown> | undefined {
  const chamada = requestMock.mock.calls.find(
    (c) => String(c[0]).endsWith('/documento') && (c[1] as { method?: string })?.method === 'POST',
  );
  return chamada ? (chamada[1] as { body: Record<string, unknown> }).body : undefined;
}

/** Do primeiro render até o arquivo ter sido enviado para leitura. */
async function mandarODocumento() {
  renderizarTela(<DocumentoDaDivida />);
  await waitFor(() => expect(screen.getByText('Que documento é?')).toBeTruthy());
  fireEvent.press(screen.getByText('Escolher arquivo'));
  await waitFor(() => expect(screen.getByText('Enviar para leitura')).toBeTruthy());
  fireEvent.press(screen.getByText('Enviar para leitura'));
}

describe('escolha do documento', () => {
  it('mostra o carregamento da dívida', () => {
    nuncaResponde();
    renderizarTela(<DocumentoDaDivida />);
    expect(screen.getByText('Carregando a dívida')).toBeTruthy();
  });

  it('erro ao abrir a dívida não é beco: tem retry e saída', async () => {
    responderPorRota({ '/v1/dividas/': new ApiError(500, 'Erro 500.') });
    renderizarTela(<DocumentoDaDivida />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
    expect(screen.getByText('Voltar para a dívida')).toBeTruthy();
  });

  it('avisa que o arquivo será descartado ANTES do toque que abre o seletor', async () => {
    // Transparência é parte do consentimento (guardrail 8.3), não cortesia.
    mockFluxo();
    renderizarTela(<DocumentoDaDivida />);

    await waitFor(() => expect(screen.getByText(/lido e descartado/)).toBeTruthy());
    expect(screen.getByText(/Nada muda na dívida antes de você revisar/)).toBeTruthy();
    // E o aviso está na tela antes de existir qualquer arquivo escolhido.
    expect(screen.getByText('Escolher arquivo')).toBeTruthy();
    expect(screen.queryByText('Enviar para leitura')).toBeNull();
  });

  it('aceita qualquer um dos quatro tipos de documento', async () => {
    mockFluxo();
    renderizarTela(<DocumentoDaDivida />);

    await waitFor(() => expect(screen.getByText('Que documento é?')).toBeTruthy());
    expect(screen.getByText('Contrato')).toBeTruthy();
    expect(screen.getByText('Boleto')).toBeTruthy();
    expect(screen.getByText('Carta')).toBeTruthy();
    expect(screen.getByText('Print')).toBeTruthy();
  });

  it('NOMEIA a troca quando a dívida já tem documento (ADR 0025, decisão 6)', async () => {
    mockFluxo({ divida: umaDivida({ extracaoId: 'extracao-antiga' }) });
    renderizarTela(<DocumentoDaDivida />);

    await waitFor(() => expect(screen.getByText('Trocar o documento')).toBeTruthy());
    expect(screen.getByText(/entra no lugar dele/)).toBeTruthy();
  });

  it('numa dívida sem documento, convida a mandar — sem falar em troca', async () => {
    mockFluxo();
    renderizarTela(<DocumentoDaDivida />);

    await waitFor(() => expect(screen.getByText('Mandar o documento')).toBeTruthy());
    expect(screen.queryByText(/entra no lugar dele/)).toBeNull();
  });
});

describe('os quatro estados da leitura', () => {
  it('acompanha a leitura enquanto processa', async () => {
    mockFluxo({ extracao: { id: 'extracao-1', status: 'processando', tipo: 'contrato' } });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('Lendo o documento')).toBeTruthy());
    expect(screen.getByText(/menos de um minuto/)).toBeTruthy();
  });

  it('na falha da extração, oferece duas saídas em vez de um beco', async () => {
    mockFluxo({
      extracao: { id: 'extracao-1', status: 'falhou', tipo: 'contrato', erro: 'Imagem ilegível.' },
    });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('Não consegui ler')).toBeTruthy());
    expect(screen.getByText('Imagem ilegível.')).toBeTruthy();
    expect(screen.getByText('Tentar outro arquivo')).toBeTruthy();
    expect(screen.getByText('Voltar para a dívida')).toBeTruthy();
  });

  it('VAZIO: sem nada citável, não liga nada e ainda assim tem saída', async () => {
    // Concluída, com valor em todo campo e trecho em nenhum: o descarte do
    // guardrail 8.1 esvazia a conciliação, e ligar às cegas seria o oposto dele.
    mockFluxo({
      extracao: umaExtracao({
        campos: {
          credor: { valor: 'Banco Teste S/A', confianca: 'alta' },
          valorCobrado: { valor: 999999, confianca: 'alta' },
          dataOrigem: { valor: null, confianca: 'baixa' },
          tipo: { valor: null, confianca: 'baixa' },
          taxaJurosMensal: { valor: null, confianca: 'baixa' },
          totalParcelas: { valor: null, confianca: 'baixa' },
          cet: { valor: null, confianca: 'baixa' },
        },
      }),
    });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText(/nada citável nesse arquivo/)).toBeTruthy());
    expect(screen.getByText('Tentar outro arquivo')).toBeTruthy();
    expect(screen.getByText('Voltar para a dívida')).toBeTruthy();
    // E o número sem evidência não aparece em lugar nenhum.
    expect(screen.queryByText('R$ 9.999,99')).toBeNull();
    expect(corpoDoVinculo()).toBeUndefined();
  });

  it('CONTEÚDO: a conciliação mostra os dois lados, com o trecho à vista', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('O que você quer usar?')).toBeTruthy());
    expect(screen.getByText('Você informou R$ 990,00')).toBeTruthy();
    expect(screen.getByText('R$ 1.500,00')).toBeTruthy();
    // O trecho do documento é o que sustenta o valor — texto puro, sempre.
    expect(screen.getByText('Valor total: R$ 1.500,00')).toBeTruthy();
  });
});

describe('conciliação — o digitado vence por padrão', () => {
  it('DIVERGÊNCIA nasce desmarcada (ADR 0025, decisão 3)', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('O que você quer usar?')).toBeTruthy());
    const linha = screen.getByLabelText(/^Valor cobrado\./);
    expect(linha.props.accessibilityState.checked).toBe(false);
  });

  it('campo AUSENTE na dívida nasce marcado — não há o que sobrescrever', async () => {
    // `umaDivida` não tem taxa de juros: é o caso comum do cadastro à mão.
    mockFluxo();
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('O que você quer usar?')).toBeTruthy());
    const linha = screen.getByLabelText(/^Juros ao mês\./);
    expect(linha.props.accessibilityState.checked).toBe(true);
  });

  it('confirma mandando SÓ o que ficou marcado', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('Confirmar e revisar')).toBeTruthy());
    fireEvent.press(screen.getByText('Confirmar e revisar'));

    await waitFor(() => expect(corpoDoVinculo()).toBeDefined());
    expect(corpoDoVinculo()?.extracaoId).toBe('extracao-1');
    // A taxa que faltava entra; o valor divergente NÃO — ninguém o marcou.
    expect(corpoDoVinculo()?.campos).toEqual({ taxaJurosMensal: 1250 });
  });

  it('a divergência marcada à mão passa a viajar', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000, taxaJurosMensal: 1250 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('O que você quer usar?')).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/^Valor cobrado\./));
    fireEvent.press(screen.getByText('Confirmar e revisar'));

    await waitFor(() => expect(corpoDoVinculo()).toBeDefined());
    expect(corpoDoVinculo()?.campos).toEqual({ valorCobrado: 150000 });
  });

  it('sem nada marcado, o corpo não muda campo nenhum (RF-003)', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000, taxaJurosMensal: 1250 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('Confirmar e revisar')).toBeTruthy());
    fireEvent.press(screen.getByText('Confirmar e revisar'));

    await waitFor(() => expect(corpoDoVinculo()).toBeDefined());
    expect(corpoDoVinculo()?.extracaoId).toBe('extracao-1');
    expect(corpoDoVinculo()?.campos ?? {}).toEqual({});
  });

  it('quando TUDO confere, diz isso e liga assim mesmo', async () => {
    // O vínculo é o que destrava os encargos na revisão — sem ele, a dívida
    // continua condenada a `achados: []`.
    mockFluxo({ divida: umaDivida({ taxaJurosMensal: 1250 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('O documento confirma')).toBeTruthy());
    expect(screen.getByText('Confere com o que você informou')).toBeTruthy();
    fireEvent.press(screen.getByText('Confirmar e revisar'));

    await waitFor(() => expect(corpoDoVinculo()).toBeDefined());
    expect(corpoDoVinculo()?.extracaoId).toBe('extracao-1');
    expect(corpoDoVinculo()?.campos ?? {}).toEqual({});
  });

  it('no sucesso, cai na revisão daquela dívida — onde o achado agora existe', async () => {
    mockFluxo();
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('Confirmar e revisar')).toBeTruthy());
    fireEvent.press(screen.getByText('Confirmar e revisar'));

    await waitFor(() =>
      expect(global.mockRouter.replace).toHaveBeenCalledWith('/dividas/divida-1/revisao'),
    );
  });

  it('erro ao ligar aparece na tela, sem levar a pessoa embora', async () => {
    mockFluxo();
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('Confirmar e revisar')).toBeTruthy());
    requestMock.mockImplementation((path: string) => {
      if (path.startsWith('/v1/contratos/')) {
        return Promise.resolve({ extracao: umaExtracao() }) as never;
      }
      if (path.endsWith('/documento')) {
        return Promise.reject(new ApiError(409, 'A leitura desse documento ainda não terminou.'));
      }
      return Promise.resolve({ divida: umaDivida() }) as never;
    });
    fireEvent.press(screen.getByText('Confirmar e revisar'));

    await waitFor(() =>
      expect(screen.getByText('A leitura desse documento ainda não terminou.')).toBeTruthy(),
    );
    expect(global.mockRouter.replace).not.toHaveBeenCalled();
  });
});

// F-019: o backend passa a recalcular as parcelas pendentes quando o valor
// cobrado de uma dívida COM carnê muda. O aviso só faz sentido quando o valor
// de fato vai mudar — ou seja, quando a linha de `valorCobrado` está marcada.
describe('aviso de recálculo do carnê', () => {
  it('COM carnê e linha de valor MARCADA, avisa antes de confirmar', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000, totalParcelas: 12 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('O que você quer usar?')).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/^Valor cobrado\./));

    expect(screen.getByText(/parcelas ainda não pagas deste carnê/)).toBeTruthy();
    expect(screen.getByText(/parcelas já pagas não mudam/)).toBeTruthy();
  });

  it('COM carnê e linha de valor DESMARCADA, não avisa', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000, totalParcelas: 12 }) });
    await mandarODocumento();

    // A divergência nasce desmarcada (ADR 0025, decisão 3): sem tocar em nada,
    // o valor não muda, e o aviso não tem o que anunciar.
    await waitFor(() => expect(screen.getByText('O que você quer usar?')).toBeTruthy());
    expect(screen.queryByText(/parcelas ainda não pagas deste carnê/)).toBeNull();
  });

  it('SEM carnê, não avisa mesmo com a linha de valor marcada', async () => {
    mockFluxo({ divida: umaDivida({ valorCobrado: 99000 }) });
    await mandarODocumento();

    await waitFor(() => expect(screen.getByText('O que você quer usar?')).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/^Valor cobrado\./));

    expect(screen.queryByText(/parcelas ainda não pagas deste carnê/)).toBeNull();
  });
});
