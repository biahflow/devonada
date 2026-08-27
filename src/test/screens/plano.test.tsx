import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import PlanoDePagamento from '../../../app/(tabs)/dividas/[id]/plano';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { renderizarTela } from '../render';

const umaParcela = (over = {}) => ({
  id: 'p1',
  numero: 1,
  total: 3,
  valor: 50000,
  vencimento: '2026-09-10',
  situacao: 'pendente',
  pagoEm: null,
  valorPago: null,
  ...over,
});

beforeEach(() => global.definirParametrosDeRota({ id: 'divida-1' }));
afterEach(limparMocksDeRede);

describe('tela de plano de pagamento', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<PlanoDePagamento />);
    expect(screen.getByText('Carregando o carnê')).toBeTruthy();
  });

  it('mostra erro com retry', async () => {
    responderPorRota({ '/v1/dividas/': new ApiError(500, 'Erro 500.') });
    renderizarTela(<PlanoDePagamento />);
    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('sem carnê, oferece editar a dívida e registrar renegociação', async () => {
    responderPorRota({ '/v1/dividas/': { parcelas: [] } });
    renderizarTela(<PlanoDePagamento />);

    await waitFor(() => expect(screen.getByText('Sem carnê para esta dívida')).toBeTruthy());
    expect(screen.getByText('Editar dívida')).toBeTruthy();
    expect(screen.getByText('Registrar renegociação')).toBeTruthy();
  });

  it('lista as parcelas com número, valor e vencimento', async () => {
    responderPorRota({
      '/v1/dividas/': {
        parcelas: [umaParcela(), umaParcela({ id: 'p2', numero: 2, vencimento: '2026-10-10' })],
      },
    });
    renderizarTela(<PlanoDePagamento />);

    await waitFor(() => expect(screen.getByText('Parcela 1 de 3')).toBeTruthy());
    expect(screen.getByText('Parcela 2 de 3')).toBeTruthy();
    expect(screen.getAllByText('R$ 500,00')).toHaveLength(2);
    expect(screen.getByText('10/09/2026')).toBeTruthy();
  });

  it('mostra o progresso de quantas já foram pagas', async () => {
    responderPorRota({
      '/v1/dividas/': {
        parcelas: [
          umaParcela({ situacao: 'paga', pagoEm: '2026-09-09' }),
          umaParcela({ id: 'p2', numero: 2 }),
        ],
      },
    });
    renderizarTela(<PlanoDePagamento />);
    await waitFor(() => expect(screen.getByText('1 de 2 pagas')).toBeTruthy());
  });

  it('parcela paga não oferece o botão de pagar', async () => {
    responderPorRota({
      '/v1/dividas/': { parcelas: [umaParcela({ situacao: 'paga', pagoEm: '2026-09-09' })] },
    });
    renderizarTela(<PlanoDePagamento />);

    await waitFor(() => expect(screen.getByText('Paga em 09/09/2026')).toBeTruthy());
    expect(screen.queryByText('Marcar como paga')).toBeNull();
  });

  it('sinaliza atraso por texto, sem linguagem de alarme', async () => {
    responderPorRota({ '/v1/dividas/': { parcelas: [umaParcela({ situacao: 'atrasada' })] } });
    renderizarTela(<PlanoDePagamento />);
    await waitFor(() => expect(screen.getByText(/atrasada/)).toBeTruthy());
  });

  it('atualiza a tela otimisticamente ao marcar como paga', async () => {
    // A parcela vira "paga" antes de a rede responder.
    requestMock.mockImplementation((path: string) => {
      if (path.includes('/pagamento')) return new Promise(() => {});
      return Promise.resolve({ parcelas: [umaParcela()] }) as never;
    });
    renderizarTela(<PlanoDePagamento />);

    await waitFor(() => expect(screen.getByText('Marcar como paga')).toBeTruthy());
    fireEvent.press(screen.getByText('Marcar como paga'));

    await waitFor(() => expect(screen.queryByText('Marcar como paga')).toBeNull());
  });

  it('reverte o otimismo quando o pagamento falha', async () => {
    requestMock.mockImplementation((path: string) => {
      if (path.includes('/pagamento'))
        return Promise.reject(new ApiError(409, 'Essa parcela já está paga.'));
      return Promise.resolve({ parcelas: [umaParcela()] }) as never;
    });
    renderizarTela(<PlanoDePagamento />);

    await waitFor(() => expect(screen.getByText('Marcar como paga')).toBeTruthy());
    fireEvent.press(screen.getByText('Marcar como paga'));

    // Volta ao estado anterior e explica o porquê.
    await waitFor(() => expect(screen.getByText('Essa parcela já está paga.')).toBeTruthy());
    expect(screen.getByText('Marcar como paga')).toBeTruthy();
  });
});

// A tela de renegociação virou registro de negociação por canal (M12) e tem
// suíte própria em `renegociar.test.tsx`.
