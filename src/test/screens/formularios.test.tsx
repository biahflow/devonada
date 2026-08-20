import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import NovaDivida from '../../../app/(tabs)/dividas/nova';
import EditarDivida from '../../../app/(tabs)/dividas/[id]/editar';
import Preferencias from '../../../app/(tabs)/painel/preferencias';
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

describe('rascunho vindo do chat', () => {
  it('abre o cadastro preenchido e avisa que veio da conversa', () => {
    global.definirParametrosDeRota({
      credor: 'Nubank',
      valorCobrado: '150000',
      tipo: 'consumo',
    });
    renderizarTela(<NovaDivida />);

    expect(screen.getByText(/Confira antes de salvar/)).toBeTruthy();
    expect(screen.getByLabelText('Credor').props.value).toBe('Nubank');
    expect(screen.getByLabelText('Valor cobrado').props.value).toBe('R$ 1.500,00');
    // E nada foi gravado só por abrir a tela.
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('parâmetro inválido não vira valor no formulário', () => {
    // Guardrail 7.3: parâmetro de rota é entrada não confiável. O campo abre
    // vazio, que é a verdade sobre o que se sabe dele.
    global.definirParametrosDeRota({ credor: 'Nubank', valorCobrado: 'mil e quinhentos' });
    renderizarTela(<NovaDivida />);

    expect(screen.getByLabelText('Credor').props.value).toBe('Nubank');
    expect(screen.getByLabelText('Valor cobrado').props.value).toBe('');
  });

  it('sem rascunho, o cadastro mantém a descrição de sempre', () => {
    renderizarTela(<NovaDivida />);
    expect(screen.getByText(/O resto o Tino ajuda a descobrir/)).toBeTruthy();
  });

  it('na edição, o campo proposto entra por cima e o resto continua salvo', async () => {
    responderPorRota({
      '/v1/dividas/': {
        divida: umaDivida({ credor: 'Nubank', valorCobrado: 45000, taxaJurosMensal: 1250 }),
      },
    });
    global.definirParametrosDeRota({ id: 'divida-1', taxaJurosMensal: '250' });
    renderizarTela(<EditarDivida />);

    await waitFor(() => expect(screen.getByLabelText('Juros ao mês').props.value).toBe('2,50%'));
    expect(screen.getByLabelText('Credor').props.value).toBe('Nubank');
    expect(screen.getByLabelText('Valor cobrado').props.value).toBe('R$ 450,00');
    expect(screen.getByText(/Confira antes de salvar/)).toBeTruthy();
  });
});

describe('tela de preferências', () => {
  it('mostra o carregamento do perfil', () => {
    nuncaResponde();
    renderizarTela(<Preferencias />);
    expect(screen.getByText('Carregando seu perfil')).toBeTruthy();
  });

  it('não coleta renda — ela mora no Caixa', async () => {
    // A garantia de que a segunda porta para o mesmo dado não volta. Enquanto
    // ela existiu, quem preenchia o Caixa via o painel vazio.
    responderPorRota({ '/v1/perfil': { perfil: umPerfil({ rendaMensal: 550000 }) } });
    renderizarTela(<Preferencias />);

    await waitFor(() => expect(screen.getByText('Salvar')).toBeTruthy());
    expect(screen.queryByLabelText('Renda mensal')).toBeNull();
  });

  it('salva sem renda e sem exigi-la', async () => {
    // Antes o formulário travava em "Informe sua renda mensal" — quem só queria
    // mudar o horário do lembrete tinha de redigitar a renda que já estava no
    // Caixa. E `rendaMensal` não pode ir no corpo: ausente é "não mexe".
    responderPorRota({ '/v1/perfil': { perfil: umPerfil({ rendaMensal: 550000 }) } });
    renderizarTela(<Preferencias />);

    await waitFor(() => expect(screen.getByText('Salvar')).toBeTruthy());
    requestMock.mockClear();
    fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    const corpo = requestMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(corpo).toHaveProperty('horaLembrete');
    expect(corpo).not.toHaveProperty('rendaMensal');
  });

  it('aponta para onde a renda é editada', async () => {
    responderPorRota({ '/v1/perfil': { perfil: {} } });
    renderizarTela(<Preferencias />);

    await waitFor(() => expect(screen.getByText(/renda fica na aba Caixa/)).toBeTruthy());
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
    // O botão de enviar é um ícone circular, como no design system: sem texto
    // visível, ele é encontrado pelo accessibilityLabel obrigatório.
    expect(screen.getByLabelText('Enviar')).toBeTruthy();
  });
});
