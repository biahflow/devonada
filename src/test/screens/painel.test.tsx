import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import Painel from '../../../app/(tabs)/painel/index';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { umResumo } from '../mocks';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

describe('tela do painel', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<Painel />);
    expect(screen.getByText('Somando tudo')).toBeTruthy();
  });

  it('mostra erro com retry', async () => {
    responderPorRota({ '/v1/dividas/resumo': new ApiError(500, 'Erro 500.') });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('exibe o total devido e a contagem', async () => {
    responderPorRota({
      '/v1/dividas/resumo': { resumo: umResumo({ totalDevido: 4850000, quantidadeDividas: 3 }) },
    });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('R$ 48.500,00')).toBeTruthy());
    expect(screen.getByText('em 3 dívidas')).toBeTruthy();
  });

  it('convida a informar a renda quando ela não veio', async () => {
    responderPorRota({
      '/v1/dividas/resumo': { resumo: umResumo({ comprometimentoRenda: undefined }) },
    });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('Quanto da sua renda isso ocupa?')).toBeTruthy());
    expect(screen.getByText('Informar renda')).toBeTruthy();
  });

  it('exibe o medidor quando há comprometimento, sem alarmar dentro do limite', async () => {
    responderPorRota({
      '/v1/dividas/resumo': { resumo: umResumo({ comprometimentoRenda: 2200 }) },
    });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('22,00%')).toBeTruthy());
    expect(screen.queryByText(/Acima do limite/)).toBeNull();
  });

  it('avisa por TEXTO quando o comprometimento passa do limite saudável', async () => {
    responderPorRota({
      '/v1/dividas/resumo': { resumo: umResumo({ comprometimentoRenda: 5500 }) },
    });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText(/Acima do limite saudável/)).toBeTruthy());
  });

  it('juros médios ausentes viram "ainda não calculado", não zero', async () => {
    responderPorRota({
      '/v1/dividas/resumo': { resumo: umResumo({ custoMedioJurosMensal: undefined }) },
    });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('ainda não calculado')).toBeTruthy());
    expect(screen.queryByText('0,00% a.m.')).toBeNull();
  });

  it('explica a ausência de histórico em vez de desenhar um gráfico vazio', async () => {
    responderPorRota({ '/v1/dividas/resumo': { resumo: umResumo({ evolucaoSaldo: [] }) } });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText(/Ainda não há histórico suficiente/)).toBeTruthy());
  });

  it('desenha a curva quando há histórico, rotulando os extremos', async () => {
    responderPorRota({
      '/v1/dividas/resumo': {
        resumo: umResumo({
          evolucaoSaldo: [
            { mes: '2026-06', saldo: 5400000 },
            { mes: '2026-07', saldo: 5210000 },
          ],
        }),
      },
    });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('jun/26')).toBeTruthy());
    expect(screen.getByText('jul/26')).toBeTruthy();
    expect(screen.getByText('R$ 54.000,00')).toBeTruthy();
  });

  it('estado vazio do mês corrente convida a cadastrar', async () => {
    responderPorRota({ '/v1/dividas/resumo': { resumo: umResumo({ quantidadeDividas: 0 }) } });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('Nada a somar ainda')).toBeTruthy());
    expect(screen.getByText('Ir para dívidas')).toBeTruthy();
  });

  it('bloqueia a navegação para o futuro', async () => {
    responderPorRota({ '/v1/dividas/resumo': { resumo: umResumo() } });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('R$ 48.500,00')).toBeTruthy());
    const proximo = screen.getByLabelText('Mês seguinte');
    expect(proximo.props.accessibilityState.disabled).toBe(true);
  });

  it('navegar para o mês anterior distingue o vazio de "sem dívidas"', async () => {
    responderPorRota({ '/v1/dividas/resumo': { resumo: umResumo({ quantidadeDividas: 0 }) } });
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('Nada a somar ainda')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Mês anterior'));

    await waitFor(() => expect(screen.getByText('Nenhuma dívida neste mês')).toBeTruthy());
    expect(screen.getByText('Voltar para o mês atual')).toBeTruthy();
  });
});
