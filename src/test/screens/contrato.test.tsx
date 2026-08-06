import { screen, waitFor } from '@testing-library/react-native';
import EnviarContrato from '../../../app/(tabs)/dividas/contrato/index';
import RevisarExtracao from '../../../app/(tabs)/dividas/contrato/[id]';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { umaExtracao } from '../mocks';
import { renderizarTela } from '../render';

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
    extracao.campos!.valorCobrado = { valor: 999999, confianca: 'alta' };
    responderPorRota({ '/v1/contratos/': { extracao } });
    renderizarTela(<RevisarExtracao />);

    await waitFor(() => expect(screen.getByText(/sem trecho que comprove/)).toBeTruthy());
    expect(screen.queryByText('R$ 9.999,99')).toBeNull();
  });

  it('campo não encontrado diz isso, sem inventar zero', async () => {
    const extracao = umaExtracao();
    extracao.campos!.cet = { valor: null, confianca: 'baixa' };
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
});
