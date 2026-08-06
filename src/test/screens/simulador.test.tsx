import { act, screen, waitFor, fireEvent, within } from '@testing-library/react-native';
import Simulador from '../../../app/(tabs)/dividas/simulador';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { umResumo, umaResposta, umaSimulacao } from '../mocks';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

/** O resumo é consultado junto, só para o teto do slider. */
function responder(simulacao: unknown) {
  responderPorRota({
    '/v1/dividas/simulacoes': simulacao,
    '/v1/dividas/resumo': { resumo: umResumo({ margemDisponivel: 80000 }) },
  });
}

describe('tela do simulador', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<Simulador />);
    expect(screen.getByText('Montando o plano')).toBeTruthy();
  });

  it('mostra erro de servidor com retry', async () => {
    responder(new ApiError(500, 'Erro 500.'));
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('estado vazio convida a cadastrar dívida', async () => {
    responder(umaResposta({ simulacoes: [], comparacao: null }));
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText('Nada para simular ainda')).toBeTruthy());
    expect(screen.getByText('Ir para dívidas')).toBeTruthy();
  });

  it('exibe a data de liberdade e as duas estratégias', async () => {
    responder(umaResposta());
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText('outubro de 2028')).toBeTruthy());
    expect(screen.getByText('Avalanche')).toBeTruthy();
    expect(screen.getByText('Bola de neve')).toBeTruthy();
    expect(screen.getByText('26 meses')).toBeTruthy();
  });

  it('a diferença vem de `comparacao`, não de uma subtração local', async () => {
    responder(umaResposta());
    renderizarTela(<Simulador />);

    // 130000 é o campo do backend. A subtração dos dois totais daria o mesmo
    // aqui de propósito: o que o teste garante é que o número exibido é o do
    // contrato, e a asserção quebra se alguém trocar por uma conta local com
    // outro arredondamento.
    await waitFor(() => expect(screen.getByText('R$ 1.300,00')).toBeTruthy());
    expect(screen.getByText('2 meses')).toBeTruthy();
  });

  it('não elege vencedora para o usuário', async () => {
    responder(umaResposta());
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText('Avalanche')).toBeTruthy());
    expect(screen.getByText(/vale mais a que você consegue manter/)).toBeTruthy();
    expect(screen.queryByText(/estratégia certa/i)).toBeNull();
    expect(screen.queryByText(/recomendada/i)).toBeNull();
  });

  it('trocar de estratégia troca a data de liberdade exibida', async () => {
    responder(umaResposta());
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText('outubro de 2028')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Estratégia Bola de neve'));

    await waitFor(() => expect(screen.getByText('dezembro de 2028')).toBeTruthy());
  });

  it('exibe a ordem de pagamento com o mês previsto', async () => {
    responder(umaResposta());
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText('Cartão X')).toBeTruthy());
    expect(screen.getByText('fecha em dezembro de 2026')).toBeTruthy();
  });

  it('economia ausente vira "ainda não calculado", nunca zero', async () => {
    responder(
      umaResposta({
        simulacoes: [umaSimulacao({ economiaVsMinimo: null })],
        comparacao: null,
      }),
    );
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText('ainda não calculado')).toBeTruthy());
    // Dentro do cartão da estratégia — fora dele, "R$ 0,00" é o piso do slider.
    const cartao = within(screen.getByLabelText('Estratégia Avalanche'));
    expect(cartao.queryByText('R$ 0,00')).toBeNull();
  });

  it('nomeia as dívidas que entraram sem taxa conhecida', async () => {
    responder(
      umaResposta({ dividasSemTaxa: [{ dividaId: 'divida-9', credor: 'Financeira Y' }] }),
    );
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText(/Financeira Y/)).toBeTruthy());
    expect(screen.getByText(/o prazo real pode ser maior/)).toBeTruthy();
  });

  it('422 de mínimo existencial explica em vez de virar erro genérico', async () => {
    const recusa = new ApiError(
      422,
      'Esse aporte passa do que sobra depois do mínimo para viver. Tente um valor menor.',
    );
    responder(recusa);
    renderizarTela(<Simulador />);

    await waitFor(() => expect(screen.getByText(/mínimo para viver/)).toBeTruthy());
    // O ErrorState genérico apagaria justamente a explicação do backend.
    expect(screen.queryByText('Não deu certo')).toBeNull();
    expect(screen.queryByText('Tentar de novo')).toBeNull();
  });

  it('o aporte só vira requisição depois que o usuário para de mexer', async () => {
    jest.useFakeTimers();
    try {
      responder(umaResposta());
      renderizarTela(<Simulador />);

      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      const chamadasIniciais = requestMock.mock.calls.filter(
        ([rota]) => rota === '/v1/dividas/simulacoes',
      ).length;

      // Três toques seguidos no campo: uma requisição só deve sair.
      fireEvent.changeText(screen.getByLabelText('Aporte extra por mês'), '100');
      fireEvent.changeText(screen.getByLabelText('Aporte extra por mês'), '1000');
      fireEvent.changeText(screen.getByLabelText('Aporte extra por mês'), '10000');

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      const simulacoes = requestMock.mock.calls.filter(
        ([rota]) => rota === '/v1/dividas/simulacoes',
      );
      expect(simulacoes.length).toBe(chamadasIniciais + 1);
      // Centavos inteiros no corpo, sempre: R$ 100,00 = 10000.
      expect(simulacoes[simulacoes.length - 1]?.[1]?.body).toEqual({
        aporteExtraMensal: 10000,
        estrategias: ['avalanche', 'bola_de_neve'],
        dividasIds: null,
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
