import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import DetalheDivida from '../../../app/(tabs)/dividas/[id]/index';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { umaDivida } from '../mocks';
import { renderizarTela } from '../render';

beforeEach(() => global.definirParametrosDeRota({ id: 'divida-1' }));
afterEach(limparMocksDeRede);

describe('tela de detalhe da dívida', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<DetalheDivida />);
    expect(screen.getByText('Carregando a dívida')).toBeTruthy();
  });

  it('mostra erro com retry quando o endpoint ainda não existe', async () => {
    responderPorRota({ '/v1/dividas/': new ApiError(404, 'Erro 404.') });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Não encontramos isso')).toBeTruthy());
  });

  it('exibe os valores e a classificação', async () => {
    responderPorRota({
      '/v1/dividas/': { divida: umaDivida({ credor: 'Nubank', valorCobrado: 150000 }) },
    });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Nubank')).toBeTruthy());
    expect(screen.getByText('R$ 1.500,00')).toBeTruthy();
    expect(screen.getByText('Juros altos')).toBeTruthy();
  });

  it('campo não calculado NÃO vira R$ 0,00', async () => {
    responderPorRota({
      '/v1/dividas/': {
        divida: umaDivida({ valorCorrigido: undefined, saldoDevedor: undefined }),
      },
    });
    renderizarTela(<DetalheDivida />);

    await waitFor(() =>
      expect(screen.getAllByText('ainda não calculado').length).toBeGreaterThan(0),
    );
    expect(screen.queryByText('R$ 0,00')).toBeNull();
  });

  it('apresenta prescrição como sinal para INVESTIGAR, nunca como certeza', async () => {
    responderPorRota({
      '/v1/dividas/': { divida: umaDivida({ possivelPrescricao: true }) },
    });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText(/pode ter prescrito/i)).toBeTruthy());
    expect(screen.getByText(/não uma certeza/i)).toBeTruthy();
  });

  it('não afirma prescrição quando o backend não sinalizou', async () => {
    responderPorRota({ '/v1/dividas/': { divida: umaDivida({ possivelPrescricao: false }) } });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Banco Teste S/A')).toBeTruthy());
    expect(screen.queryByText(/prescrito/i)).toBeNull();
  });

  it('carrega o disclaimer de estimativa educacional', async () => {
    responderPorRota({ '/v1/dividas/': { divida: umaDivida() } });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText(/Não é aconselhamento jurídico/)).toBeTruthy());
  });

  // F-019, RF-009. A dívida cadastrada à mão ficava sem caminho para o
  // documento — e sem documento a revisão dela nunca produz achado.
  it('oferece MANDAR o documento quando a dívida não tem nenhum', async () => {
    responderPorRota({ '/v1/dividas/': { divida: umaDivida({ extracaoId: null }) } });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Mandar o documento')).toBeTruthy());
    expect(screen.queryByText('Trocar o documento')).toBeNull();
  });

  it('oferece TROCAR quando já há documento — a substituição é nomeada', async () => {
    // Uma dívida tem no máximo um documento, e ligar de novo substitui
    // (ADR 0025, decisão 6). Descobrir isso depois seria troca silenciosa.
    responderPorRota({ '/v1/dividas/': { divida: umaDivida({ extracaoId: 'extracao-1' }) } });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Trocar o documento')).toBeTruthy());
    expect(screen.queryByText('Mandar o documento')).toBeNull();
  });

  it('leva para a tela de documento daquela dívida', async () => {
    responderPorRota({ '/v1/dividas/': { divida: umaDivida() } });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Mandar o documento')).toBeTruthy());
    fireEvent.press(screen.getByText('Mandar o documento'));
    expect(global.mockRouter.push).toHaveBeenCalledWith('/dividas/divida-1/documento');
  });

  it('esconde "marcar como quitada" numa dívida já quitada', async () => {
    responderPorRota({ '/v1/dividas/': { divida: umaDivida({ situacao: 'quitada' }) } });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Banco Teste S/A')).toBeTruthy());
    expect(screen.queryByText('Marcar como quitada')).toBeNull();
  });
});
