import { screen, waitFor } from '@testing-library/react-native';
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

  it('esconde "marcar como quitada" numa dívida já quitada', async () => {
    responderPorRota({ '/v1/dividas/': { divida: umaDivida({ situacao: 'quitada' }) } });
    renderizarTela(<DetalheDivida />);

    await waitFor(() => expect(screen.getByText('Banco Teste S/A')).toBeTruthy());
    expect(screen.queryByText('Marcar como quitada')).toBeNull();
  });
});
