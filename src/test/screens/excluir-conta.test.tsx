import { Alert } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import ExcluirConta from '../../../app/(tabs)/painel/excluir-conta';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, requestMock } from '../api';
import { renderizarTela } from '../render';

jest.mock('../../api/sessao', () => ({
  ...jest.requireActual('../../api/sessao'),
  esquecerSessao: jest.fn().mockResolvedValue(undefined),
}));

/** Captura o Alert nativo sem confirmá-lo: quem confirma é cada teste. */
let confirmar: (() => void) | undefined;

beforeEach(() => {
  confirmar = undefined;
  jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _msg, botoes) => {
    const excluir = botoes?.find((b) => b.text === 'Excluir');
    confirmar = () => excluir?.onPress?.();
  });
});

afterEach(() => {
  limparMocksDeRede();
  jest.restoreAllMocks();
});

function tocarBotao(nome: string) {
  fireEvent.press(screen.getByRole('button', { name: nome }));
}

describe('Excluir conta', () => {
  it('lista o que some ANTES de pedir qualquer coisa', () => {
    renderizarTela(<ExcluirConta />);

    expect(screen.getByText('O que é apagado')).toBeTruthy();
    expect(screen.getByText(/dívidas, parcelas, pagamentos/i)).toBeTruthy();
    expect(screen.getByText(/histórico de conversa/i)).toBeTruthy();
  });

  it('NÃO exclui sem a confirmação nativa', async () => {
    // O gêmeo do teste do M5 que prova que a conversa não cria dívida: aqui, que
    // a tela não apaga a conta sem o usuário dizer sim duas vezes.
    renderizarTela(<ExcluirConta />);

    fireEvent.changeText(screen.getByLabelText('Sua senha'), 'senha-bem-boa');
    tocarBotao('Excluir minha conta');

    expect(Alert.alert).toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('exclui e leva ao login quando o usuário confirma', async () => {
    requestMock.mockResolvedValue(undefined);
    renderizarTela(<ExcluirConta />);

    fireEvent.changeText(screen.getByLabelText('Sua senha'), 'senha-bem-boa');
    tocarBotao('Excluir minha conta');
    confirmar?.();

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/v1/conta', {
        method: 'DELETE',
        body: { senha: 'senha-bem-boa' },
      }),
    );
    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/login'));
  });

  it('sem senha não abre nem a confirmação', async () => {
    renderizarTela(<ExcluirConta />);
    tocarBotao('Excluir minha conta');

    expect(await screen.findByText('Digite sua senha para confirmar.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('senha errada mostra a frase do servidor e não desloga', async () => {
    requestMock.mockRejectedValue(new ApiError(401, 'A senha não confere.'));
    renderizarTela(<ExcluirConta />);

    fireEvent.changeText(screen.getByLabelText('Sua senha'), 'errada');
    tocarBotao('Excluir minha conta');
    confirmar?.();

    expect(await screen.findByText('A senha não confere.')).toBeTruthy();
    expect(global.mockRouter.replace).not.toHaveBeenCalled();
  });

  it('diz que o arquivo do contrato nunca chegou a ser guardado', () => {
    renderizarTela(<ExcluirConta />);
    expect(screen.getByText(/lido e descartado/i)).toBeTruthy();
  });
});
