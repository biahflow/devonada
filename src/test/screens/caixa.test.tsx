import { screen, waitFor } from '@testing-library/react-native';
import CaixaScreen from '../../../app/(tabs)/caixa/index';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { umCaixa } from '../mocks';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

describe('tela de caixa', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<CaixaScreen />);
    expect(screen.getByText('Somando seu mês')).toBeTruthy();
  });

  it('mostra erro com retry', async () => {
    responderPorRota({ '/v1/caixa': new ApiError(500, 'Erro 500.') });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('convida ao atalho de 20 segundos quando nada foi preenchido', async () => {
    // O vazio mais importante desta tela: quem está endividado não preenche
    // formulário, então o valor tem de vir antes do esforço.
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ preenchimento: 'vazio' }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Leva 20 segundos')).toBeTruthy());
    expect(screen.getByText('Informar renda')).toBeTruthy();
  });

  it('exibe a cascata com a sobra do mês', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa() } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Sobra por mês')).toBeTruthy());
    expect(screen.getByText('R$ 10.000,00')).toBeTruthy();
    expect(screen.getByText('R$ 4.000,00')).toBeTruthy();
    // Aparece duas vezes de propósito: na sobra da cascata e no tile de aporte,
    // que coincidem quando não há parcela comprometida.
    expect(screen.getAllByText('R$ 6.000,00')).toHaveLength(2);
  });

  it('exibe capacidade negativa como negativa, sem esconder nem zerar', async () => {
    responderPorRota({
      '/v1/caixa': { caixa: umCaixa({ capacidadeHoje: -120000, capacidadeMaxima: -120000 }) },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('-R$ 1.200,00')).toBeTruthy());
  });

  it('avisa quando os números não fecham, sem dizer que a pessoa está superendividada', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ naoFecha: true }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText(/não cabem no que sobra/)).toBeTruthy());
    // A definição legal exige boa-fé e dívida de consumo (CDC art. 54-A, § 1º),
    // e software não apura nenhuma das duas.
    expect(screen.queryByText(/superendividad/i)).toBeNull();
  });

  it('avisa quando a sobra fica abaixo do piso legal', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ abaixoDoPiso: true }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText(/mínimo existencial que a lei protege/)).toBeTruthy());
  });

  it('diz quando a renda veio do pior mês registrado', async () => {
    // O usuário precisa saber se o número que ele vê é o que digitou ou o que
    // de fato recebeu.
    responderPorRota({
      '/v1/caixa': { caixa: umCaixa({ origemRenda: 'pior_mes_registrado' }) },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText(/pior mês registrado/)).toBeTruthy());
  });

  it('mostra a alavanca do não essencial sem mandar cortar', async () => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({ naoEssenciais: 90000, capacidadeHoje: 510000, capacidadeMaxima: 600000 }),
      },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Cortando o não essencial')).toBeTruthy());
    expect(screen.getByText('É a sua alavanca — a escolha é sua, não do app.')).toBeTruthy();
  });
});

describe('copy do caixa', () => {
  it('nunca elege uma ordem de prioridade nem afirma direito', async () => {
    // Gêmeo dos testes que quebram em "recomendada" (M4) e "ilegal" (M6).
    // ADR 0009: o app mostra a aritmética, o usuário decide.
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ naoFecha: true, abaixoDoPiso: true }) } });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Sobra por mês')).toBeTruthy());

    const texto = JSON.stringify(toJSON());
    for (const proibida of ['recomendad', 'você tem direito', 'ilegal', 'abusiv', 'superendividad']) {
      expect(texto.toLowerCase()).not.toContain(proibida);
    }
  });
});
