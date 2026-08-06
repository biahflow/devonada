import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import NovaDivida from '../../../app/(tabs)/dividas/nova';
import EditarDivida from '../../../app/(tabs)/dividas/[id]/editar';
import Renda from '../../../app/(tabs)/painel/renda';
import ChatTab from '../../../app/(tabs)/index';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { umaDivida, umPerfil } from '../mocks';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

describe('tela de cadastro de dívida', () => {
  it('renderiza o formulário completo', () => {
    renderizarTela(<NovaDivida />);
    expect(screen.getByText('Nova dívida')).toBeTruthy();
    expect(screen.getByLabelText('Credor')).toBeTruthy();
    expect(screen.getByLabelText('Valor cobrado')).toBeTruthy();
    expect(screen.getByLabelText('Juros ao mês')).toBeTruthy();
  });

  it('não chama a API quando falta credor', () => {
    renderizarTela(<NovaDivida />);
    fireEvent.press(screen.getByText('Salvar dívida'));

    expect(screen.getByText('Informe quem está cobrando.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('marca os campos não obrigatórios como opcionais', () => {
    // Taxa, número de parcelas e primeiro vencimento.
    renderizarTela(<NovaDivida />);
    expect(screen.getAllByText('Opcional')).toHaveLength(3);
  });

  it('exige a data quando o número de parcelas é informado', () => {
    renderizarTela(<NovaDivida />);
    fireEvent.changeText(screen.getByLabelText('Credor'), 'Nubank');
    fireEvent.changeText(screen.getByLabelText('Valor cobrado'), '1000');
    fireEvent.changeText(screen.getByLabelText('Em quantas parcelas'), '12');
    fireEvent.press(screen.getByText('Salvar dívida'));

    expect(screen.getByText('Informe quando vence a primeira parcela.')).toBeTruthy();
  });
});

describe('tela de edição de dívida', () => {
  beforeEach(() => global.definirParametrosDeRota({ id: 'divida-1' }));

  it('mostra o carregamento antes de ter o que editar', () => {
    nuncaResponde();
    renderizarTela(<EditarDivida />);
    expect(screen.getByText('Carregando a dívida')).toBeTruthy();
  });

  it('pré-preenche com os valores da dívida carregada', async () => {
    responderPorRota({
      '/v1/dividas/': {
        divida: umaDivida({ credor: 'Nubank', valorCobrado: 45000, taxaJurosMensal: 1250 }),
      },
    });
    renderizarTela(<EditarDivida />);

    await waitFor(() => expect(screen.getByLabelText('Credor').props.value).toBe('Nubank'));
    expect(screen.getByLabelText('Valor cobrado').props.value).toBe('R$ 450,00');
    expect(screen.getByLabelText('Juros ao mês').props.value).toBe('12,50%');
  });
});

describe('tela de renda', () => {
  it('mostra o carregamento do perfil', () => {
    nuncaResponde();
    renderizarTela(<Renda />);
    expect(screen.getByText('Carregando seu perfil')).toBeTruthy();
  });

  it('pré-preenche a renda já informada', async () => {
    responderPorRota({ '/v1/perfil': { perfil: umPerfil({ rendaMensal: 550000 }) } });
    renderizarTela(<Renda />);

    await waitFor(() =>
      expect(screen.getByLabelText('Renda mensal').props.value).toBe('R$ 5.500,00'),
    );
  });

  it('não salva com renda zerada', async () => {
    responderPorRota({ '/v1/perfil': { perfil: {} } });
    renderizarTela(<Renda />);

    await waitFor(() => expect(screen.getByText('Salvar')).toBeTruthy());
    requestMock.mockClear();
    fireEvent.press(screen.getByText('Salvar'));

    expect(screen.getByText('Informe sua renda mensal.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('explica o que é feito com o dado — é informação sensível', async () => {
    responderPorRota({ '/v1/perfil': { perfil: {} } });
    renderizarTela(<Renda />);

    await waitFor(() => expect(screen.getByText(/Guardamos só o valor/)).toBeTruthy());
  });
});

describe('aba de chat', () => {
  it('abre com a saudação quando não há conversa anterior', async () => {
    // Desde o M5 o chat CARREGA o histórico ao abrir — antes ele nascia sempre
    // do zero, em memória. A saudação passou a ser o caso de conversa nova.
    // O comportamento completo está em src/test/screens/chat.test.tsx.
    responderPorRota({ '/v1/chat/messages': { mensagens: [] } });
    renderizarTela(<ChatTab />);

    await waitFor(() => expect(screen.getByText(/Me conta de uma dívida/)).toBeTruthy());
    expect(screen.getByText('Enviar')).toBeTruthy();
  });
});
