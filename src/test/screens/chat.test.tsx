import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ChatScreen } from '../../screens/ChatScreen';
import { ApiError } from '../../api/client';
import type { ChatMessage } from '../../api/types';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

function umaMensagem(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Aqui está o retrato da sua dívida.',
    createdAt: '2026-08-06T12:00:00Z',
    ...over,
  };
}

const CARD_DIVIDA = {
  kind: 'divida_resumo' as const,
  dividaId: 'divida-1',
  credor: 'Nubank',
  saldoDevedor: 250000,
  proximoVencimento: '2026-09-10',
  situacao: 'ativa' as const,
  criticidade: 'juros_abusivos' as const,
};

const CARD_PLANO = {
  kind: 'plano_sugerido' as const,
  estrategia: 'avalanche' as const,
  aporteExtraMensal: 20000,
  mesesAteQuitacao: 14,
  dataLiberdade: '2027-10',
  economia: 94000,
};

describe('tela do chat', () => {
  it('mostra o carregamento enquanto retoma a conversa', () => {
    nuncaResponde();
    renderizarTela(<ChatScreen />);
    expect(screen.getByText('Retomando a conversa')).toBeTruthy();
  });

  it('histórico vazio mostra a saudação', async () => {
    responderPorRota({ '/v1/chat/messages': { mensagens: [] } });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText(/Me conta de uma dívida/)).toBeTruthy());
  });

  it('histórico existente NÃO repete a saudação', async () => {
    // Repeti-la a cada abertura faria o app parecer que esqueceu a pessoa.
    responderPorRota({
      '/v1/chat/messages': { mensagens: [umaMensagem({ role: 'user', content: 'oi' })] },
    });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('oi')).toBeTruthy());
    expect(screen.queryByText(/Me conta de uma dívida/)).toBeNull();
  });

  it('falha ao carregar o histórico não impede conversar', async () => {
    responderPorRota({ '/v1/chat/messages': new ApiError(500, 'Erro 500.') });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText(/Me conta de uma dívida/)).toBeTruthy());
    expect(screen.getByLabelText('Mensagem')).toBeTruthy();
  });

  it('exibe o card de dívida com os valores do backend', async () => {
    responderPorRota({
      '/v1/chat/messages': { mensagens: [umaMensagem({ cards: [CARD_DIVIDA] })] },
    });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('Nubank')).toBeTruthy());
    expect(screen.getByText('R$ 2.500,00')).toBeTruthy();
    expect(screen.getByText('Juros altos')).toBeTruthy();
  });

  it('o card de dívida leva para o detalhe dela', async () => {
    responderPorRota({
      '/v1/chat/messages': { mensagens: [umaMensagem({ cards: [CARD_DIVIDA] })] },
    });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('Nubank')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Abrir a dívida com Nubank'));

    expect(global.mockRouter.push).toHaveBeenCalledWith('/dividas/divida-1');
  });

  it('o card de plano leva para o simulador', async () => {
    responderPorRota({
      '/v1/chat/messages': { mensagens: [umaMensagem({ cards: [CARD_PLANO] })] },
    });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('outubro de 2027')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Abrir o simulador de quitação'));

    expect(global.mockRouter.push).toHaveBeenCalledWith('/dividas/simulador');
  });

  it('economia ausente vira "ainda não calculado", nunca zero', async () => {
    responderPorRota({
      '/v1/chat/messages': {
        mensagens: [umaMensagem({ cards: [{ ...CARD_PLANO, economia: null }] })],
      },
    });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('ainda não calculado')).toBeTruthy());
    expect(screen.queryByText('R$ 0,00')).toBeNull();
  });

  it('GUARDRAIL 7.1: nenhum número aparece no texto da mensagem', async () => {
    // O assistente contextualiza; o card carrega o dado. Se um número escapar
    // para o `content`, é bug de backend — e este teste é onde ele aparece.
    responderPorRota({
      '/v1/chat/messages': {
        mensagens: [
          umaMensagem({ content: 'Aqui está o retrato da sua dívida.', cards: [CARD_DIVIDA] }),
          umaMensagem({ id: 'msg-2', content: 'Montei um plano para você.', cards: [CARD_PLANO] }),
        ],
      },
    });
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('Nubank')).toBeTruthy());

    for (const texto of ['Aqui está o retrato da sua dívida.', 'Montei um plano para você.']) {
      expect(screen.getByText(texto)).toBeTruthy();
      expect(/\d/.test(texto)).toBe(false);
    }
  });

  it('enviar mensagem exibe o que a pessoa escreveu e a resposta', async () => {
    responderPorRota({ '/v1/chat/messages': { mensagens: [] } });
    renderizarTela(<ChatScreen />);
    await waitFor(() => expect(screen.getByText(/Me conta de uma dívida/)).toBeTruthy());

    requestMock.mockImplementation((_rota, opcoes) =>
      opcoes?.method === 'POST'
        ? (Promise.resolve({
            message: umaMensagem({ id: 'msg-2', content: 'Vamos lá.' }),
          }) as ReturnType<typeof requestMock>)
        : (Promise.resolve({ mensagens: [] }) as ReturnType<typeof requestMock>),
    );

    fireEvent.changeText(screen.getByLabelText('Mensagem'), 'e o nubank?');
    fireEvent.press(screen.getByText('Enviar'));

    await waitFor(() => expect(screen.getByText('Vamos lá.')).toBeTruthy());
    expect(screen.getByText('e o nubank?')).toBeTruthy();
  });

  it('erro ao enviar aparece com a frase do backend', async () => {
    responderPorRota({ '/v1/chat/messages': { mensagens: [] } });
    renderizarTela(<ChatScreen />);
    await waitFor(() => expect(screen.getByText(/Me conta de uma dívida/)).toBeTruthy());

    requestMock.mockImplementation((_rota, opcoes) =>
      opcoes?.method === 'POST'
        ? Promise.reject(new ApiError(503, 'Não deu certo agora. Tente de novo.'))
        : (Promise.resolve({ mensagens: [] }) as ReturnType<typeof requestMock>),
    );

    fireEvent.changeText(screen.getByLabelText('Mensagem'), 'oi');
    fireEvent.press(screen.getByText('Enviar'));

    await waitFor(() => expect(screen.getByText('Não deu certo agora. Tente de novo.')).toBeTruthy());
  });
});
