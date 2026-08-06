import { screen, waitFor } from '@testing-library/react-native';
import ListaDividas from '../../../app/(tabs)/dividas/index';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { umaDivida } from '../mocks';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

describe('tela de lista de dívidas', () => {
  it('mostra o estado de carregamento enquanto a rede não responde', () => {
    nuncaResponde();
    renderizarTela(<ListaDividas />);
    expect(screen.getByText('Carregando suas dívidas')).toBeTruthy();
  });

  it('mostra erro tratado quando o backend falha, com retry', async () => {
    responderPorRota({ '/v1/dividas': new ApiError(500, 'Erro 500.') });
    renderizarTela(<ListaDividas />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });

  it('distingue 404 de falha de servidor', async () => {
    responderPorRota({ '/v1/dividas': new ApiError(404, 'Erro 404.') });
    renderizarTela(<ListaDividas />);

    await waitFor(() => expect(screen.getByText('Não encontramos isso')).toBeTruthy());
  });

  it('oferece DUAS saídas no estado vazio — contrato e cadastro à mão', async () => {
    responderPorRota({ '/v1/dividas': { dividas: [] } });
    renderizarTela(<ListaDividas />);

    await waitFor(() => expect(screen.getByText('Nenhuma dívida cadastrada')).toBeTruthy());
    expect(screen.getByText('Ler um contrato')).toBeTruthy();
    expect(screen.getByText('Cadastrar à mão')).toBeTruthy();
  });

  it('lista as dívidas com credor, valor e criticidade', async () => {
    responderPorRota({
      '/v1/dividas': {
        dividas: [
          umaDivida({ id: '1', credor: 'Nubank', valorCobrado: 45000, tipo: 'consumo' }),
          umaDivida({ id: '2', credor: 'Banco X', valorCobrado: 300000 }),
        ],
      },
    });
    renderizarTela(<ListaDividas />);

    await waitFor(() => expect(screen.getByText('Nubank')).toBeTruthy());
    expect(screen.getByText('Banco X')).toBeTruthy();
    expect(screen.getByText('R$ 450,00')).toBeTruthy();
    expect(screen.getByText('Juros altos')).toBeTruthy();
    expect(screen.getByText('Consumo')).toBeTruthy();
  });

  it('ordena por prioridade: juros altos antes de consumo', async () => {
    responderPorRota({
      '/v1/dividas': {
        dividas: [
          umaDivida({ id: 'c', credor: 'Consumo', tipo: 'consumo' }),
          umaDivida({ id: 'j', credor: 'JurosAltos', tipo: 'juros_abusivos' }),
        ],
      },
    });
    renderizarTela(<ListaDividas />);

    await waitFor(() => expect(screen.getByText('JurosAltos')).toBeTruthy());
    const textos = screen.getAllByText(/JurosAltos|Consumo/).map((n) => n.props.children);
    expect(textos.indexOf('JurosAltos')).toBeLessThan(textos.indexOf('Consumo'));
  });

  it('exibe o saldo devedor quando existe, em vez do valor cobrado', async () => {
    responderPorRota({
      '/v1/dividas': {
        dividas: [umaDivida({ valorCobrado: 150000, saldoDevedor: 90000 })],
      },
    });
    renderizarTela(<ListaDividas />);

    await waitFor(() => expect(screen.getByText('R$ 900,00')).toBeTruthy());
    expect(screen.queryByText('R$ 1.500,00')).toBeNull();
  });
});
