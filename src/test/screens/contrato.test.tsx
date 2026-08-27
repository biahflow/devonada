import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import EnviarContrato from '../../../app/(tabs)/dividas/contrato/index';
import RevisarExtracao from '../../../app/(tabs)/dividas/contrato/[id]';
import type { CamposContrato } from '../../api/contratos';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { umBoleto, umPrint, umaExtracao } from '../mocks';
import { renderizarTela } from '../render';

/** O corpo do primeiro POST /v1/dividas — a criação disparada pela confirmação. */
function corpoDaCriacao(): Record<string, unknown> {
  const chamada = requestMock.mock.calls.find(
    (c) => c[0] === '/v1/dividas' && (c[1] as { method?: string })?.method === 'POST',
  );
  return (chamada?.[1] as { body: Record<string, unknown> }).body;
}

afterEach(limparMocksDeRede);

describe('tela de envio de contrato', () => {
  it('avisa que o arquivo será descartado ANTES do upload', () => {
    // Transparência é parte do consentimento (ADR 0005), não cortesia.
    renderizarTela(<EnviarContrato />);
    expect(screen.getByText(/lido e descartado/)).toBeTruthy();
    expect(screen.getByText(/Nada é salvo antes de você revisar/)).toBeTruthy();
  });

  it('oferece o caminho manual como alternativa', () => {
    renderizarTela(<EnviarContrato />);
    expect(screen.getByText('Prefiro digitar à mão')).toBeTruthy();
  });

  it('não mostra "enviar" antes de haver arquivo escolhido', () => {
    renderizarTela(<EnviarContrato />);
    expect(screen.getByText('Escolher arquivo')).toBeTruthy();
    expect(screen.queryByText('Enviar para leitura')).toBeNull();
  });

  it('deixa escolher o tipo de documento (M13)', () => {
    renderizarTela(<EnviarContrato />);
    expect(screen.getByText('Que documento é?')).toBeTruthy();
    expect(screen.getByText('Contrato')).toBeTruthy();
    expect(screen.getByText('Boleto')).toBeTruthy();
    expect(screen.getByText('Carta')).toBeTruthy();
    expect(screen.getByText('Print')).toBeTruthy();
  });
});

describe('tela de revisão da extração', () => {
  beforeEach(() => global.definirParametrosDeRota({ id: 'extracao-1' }));

  it('mostra o carregamento inicial', () => {
    nuncaResponde();
    renderizarTela(<RevisarExtracao />);
    expect(screen.getByText('Abrindo o contrato')).toBeTruthy();
  });

  it('acompanha a leitura enquanto processa', async () => {
    responderPorRota({
      '/v1/contratos/': { extracao: { id: 'e1', status: 'processando' } },
    });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('Lendo o contrato')).toBeTruthy());
    expect(screen.getByText(/menos de um minuto/)).toBeTruthy();
  });

  it('na falha, oferece duas saídas em vez de um beco', async () => {
    responderPorRota({
      '/v1/contratos/': {
        extracao: { id: 'e1', status: 'falhou', erro: 'Imagem ilegível.' },
      },
    });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('Não consegui ler')).toBeTruthy());
    expect(screen.getByText('Imagem ilegível.')).toBeTruthy();
    expect(screen.getByText('Tentar outro arquivo')).toBeTruthy();
    expect(screen.getByText('Cadastrar à mão')).toBeTruthy();
  });

  it('exibe cada campo com o trecho do contrato que o sustenta', async () => {
    responderPorRota({ '/v1/contratos/': { extracao: umaExtracao() } });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('Confira o que li')).toBeTruthy());
    expect(screen.getByText('CREDOR: Banco Teste S/A')).toBeTruthy();
    expect(screen.getByText('Valor total: R$ 1.500,00')).toBeTruthy();
    expect(screen.getByText('Taxa: 12,50% a.m.')).toBeTruthy();
  });

  it('campo SEM trecho não propõe valor, mesmo tendo um', async () => {
    const extracao = umaExtracao();
    (extracao.campos as CamposContrato).valorCobrado = { valor: 999999, confianca: 'alta' };
    responderPorRota({ '/v1/contratos/': { extracao } });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText(/sem trecho que comprove/)).toBeTruthy());
    expect(screen.queryByText('R$ 9.999,99')).toBeNull();
  });

  it('campo não encontrado diz isso, sem inventar zero', async () => {
    const extracao = umaExtracao();
    (extracao.campos as CamposContrato).cet = { valor: null, confianca: 'baixa' };
    responderPorRota({ '/v1/contratos/': { extracao } });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('não encontramos no contrato')).toBeTruthy());
  });

  it('alerta de cláusula é apresentado como investigação, não como acusação', async () => {
    responderPorRota({
      '/v1/contratos/': {
        extracao: umaExtracao({
          alertas: [
            {
              id: 'a1',
              titulo: 'Seguro prestamista embutido',
              explicacao: 'Pode não ter sido oferecido de forma opcional.',
            },
          ],
        }),
      },
    });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('Seguro prestamista embutido')).toBeTruthy());
    expect(screen.getByText(/não uma conclusão jurídica/)).toBeTruthy();
  });

  it('deixa claro que nada é salvo até a confirmação', async () => {
    responderPorRota({ '/v1/contratos/': { extracao: umaExtracao() } });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText(/Nada é salvo até você confirmar/)).toBeTruthy());
    expect(screen.getByText('Salvar dívida')).toBeTruthy();
  });

  // A LIGAÇÃO DÍVIDA→EXTRAÇÃO (F-015, Parte 1). Antes do conserto, `NovaDivida` não
  // tinha `extracaoId`, `extracaoParaProposta` não o carregava e o `DividaForm` o
  // descartava — a dívida nascia solta e a revisão dela nunca achava nada. Este
  // teste falha se qualquer um dos três elos voltar a se romper.
  it('ao confirmar, cria a dívida LIGADA à extração (extracaoId no POST)', async () => {
    responderPorRota({
      '/v1/contratos/': { extracao: umaExtracao() },
      '/v1/dividas': { divida: { id: 'nova-1' } },
    });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('Salvar dívida')).toBeTruthy());
    fireEvent.press(screen.getByText('Salvar dívida'));

    await waitFor(() => expect(corpoDaCriacao()).toBeDefined());
    expect(corpoDaCriacao().extracaoId).toBe('extracao-1');
  });

  it('revisa um BOLETO com os campos do boleto, não os do contrato (M13)', async () => {
    responderPorRota({ '/v1/contratos/': { extracao: umBoleto() } });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('Beneficiário')).toBeTruthy());
    expect(screen.getByText('Sabesp')).toBeTruthy();
    expect(screen.getByText('Vencimento')).toBeTruthy();
    // Um boleto não tem taxa de juros a extrair — o campo do contrato não aparece.
    expect(screen.queryByText('Custo Efetivo Total')).toBeNull();
  });

  it('num PRINT, campo sem trecho não inventa valor', async () => {
    // `referencia` vem sem trecho no mock: a tela diz que não encontrou.
    responderPorRota({ '/v1/contratos/': { extracao: umPrint() } });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText('Referência')).toBeTruthy());
    expect(screen.getByText('R$ 320,00')).toBeTruthy();
    expect(screen.getByText('não encontramos no contrato')).toBeTruthy();
  });
});
