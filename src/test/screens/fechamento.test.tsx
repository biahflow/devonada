import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import FechamentoDoMes from '../../../app/(tabs)/caixa/fechamento';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

const ROTA = '/v1/caixa/fechamento';

function umaProposta(itens: unknown[]) {
  return { proposta: { mes: '2026-08', itens } };
}

const RECEBIMENTO_DO_MES_ANTERIOR = {
  tipo: 'recebimento',
  id: 'fonte-1',
  descricao: 'Contrato PJ',
  valorSugerido: 880000,
  origem: 'mes_anterior',
  mesDeReferencia: '2026-07',
};

const SEM_REFERENCIA = {
  tipo: 'recebimento',
  id: 'fonte-2',
  descricao: 'Freela',
  origem: 'sem_referencia',
};

describe('tela de fechamento do mês', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<FechamentoDoMes />);
    expect(screen.getByText('Montando o que mudou')).toBeTruthy();
  });

  it('mostra erro com retry', async () => {
    responderPorRota({ [ROTA]: new ApiError(500, 'Erro 500.') });
    renderizarTela(<FechamentoDoMes />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('o vazio explica que registro fixo não se redigita', async () => {
    // Vazio aqui é boa notícia, não beco: significa que a forma do modelo já
    // resolveu a recorrência.
    responderPorRota({ [ROTA]: umaProposta([]) });
    renderizarTela(<FechamentoDoMes />);

    await waitFor(() => expect(screen.getByText('Nada para confirmar')).toBeTruthy());
  });

  it('exibe o item e DIZ DE ONDE veio o número sugerido', async () => {
    // A procedência é o que separa pré-preencher de inventar. Sem ela, o
    // usuário não tem como saber se aquele valor é dele ou do app.
    responderPorRota({ [ROTA]: umaProposta([RECEBIMENTO_DO_MES_ANTERIOR]) });
    renderizarTela(<FechamentoDoMes />);

    await waitFor(() => expect(screen.getByText('Contrato PJ')).toBeTruthy());
    expect(screen.getByText(/sugerido a partir de/)).toBeTruthy();
  });

  it('item SEM referência não vem preenchido com zero', async () => {
    // Zero afirmaria que a pessoa não recebeu nada, que é diferente de não
    // sabermos quanto ela recebeu.
    responderPorRota({ [ROTA]: umaProposta([SEM_REFERENCIA]) });
    renderizarTela(<FechamentoDoMes />);

    await waitFor(() => expect(screen.getByText('Freela')).toBeTruthy());
    expect(screen.getByText(/sem referência anterior/)).toBeTruthy();
    // Nada a confirmar ainda: o botão conta zero valores.
    expect(screen.getByText('Confirmar 0 valores')).toBeTruthy();
  });

  it('envia SÓ o que tem valor — item vazio não vira zero', async () => {
    responderPorRota({
      [ROTA]: umaProposta([RECEBIMENTO_DO_MES_ANTERIOR, SEM_REFERENCIA]),
    });
    renderizarTela(<FechamentoDoMes />);

    await waitFor(() => expect(screen.getByText('Contrato PJ')).toBeTruthy());
    // Um dos dois tem sugestão; o outro está vazio e não pode ser enviado.
    expect(screen.getByText('Confirmar 1 valor')).toBeTruthy();

    requestMock.mockClear();
    responderPorRota({ [ROTA]: { caixa: {} } });
    fireEvent.press(screen.getByText('Confirmar 1 valor'));

    await waitFor(() => {
      const post = requestMock.mock.calls.find(([, opts]) => opts?.method === 'POST');
      expect(post).toBeTruthy();
      const corpo = post?.[1]?.body as { itens: unknown[] };
      expect(corpo.itens).toHaveLength(1);
      expect(corpo.itens[0]).toMatchObject({ tipo: 'recebimento', id: 'fonte-1' });
    });
  });
});
