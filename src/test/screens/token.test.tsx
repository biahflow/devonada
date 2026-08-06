import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import ConfigurarToken from '../../../app/(tabs)/painel/token';
import * as client from '../../api/client';
import { renderizarTela } from '../render';

jest.mock('../../api/client', () => ({
  ...jest.requireActual('../../api/client'),
  setToken: jest.fn().mockResolvedValue(undefined),
  clearToken: jest.fn().mockResolvedValue(undefined),
}));

const setToken = client.setToken as jest.MockedFunction<typeof client.setToken>;
const clearToken = client.clearToken as jest.MockedFunction<typeof client.clearToken>;

afterEach(() => {
  setToken.mockClear();
  clearToken.mockClear();
});

describe('tela de configuração de conexão', () => {
  it('explica o que acontece com o token antes de pedir que o usuário cole', () => {
    renderizarTela(<ConfigurarToken />);
    expect(screen.getByText(/guardado com criptografia/)).toBeTruthy();
  });

  it('não salva token vazio', () => {
    renderizarTela(<ConfigurarToken />);
    fireEvent.press(screen.getByText('Salvar token'));

    expect(screen.getByText('Cole o token do servidor.')).toBeTruthy();
    expect(setToken).not.toHaveBeenCalled();
  });

  it('ignora espaços em volta do valor colado', async () => {
    renderizarTela(<ConfigurarToken />);
    fireEvent.changeText(screen.getByLabelText('Token'), '  abc123  ');
    fireEvent.press(screen.getByText('Salvar token'));

    await waitFor(() => expect(setToken).toHaveBeenCalledWith('abc123'));
  });

  it('confirma o salvamento e limpa o campo', async () => {
    renderizarTela(<ConfigurarToken />);
    fireEvent.changeText(screen.getByLabelText('Token'), 'abc123');
    fireEvent.press(screen.getByText('Salvar token'));

    await waitFor(() => expect(screen.getByText(/Token salvo/)).toBeTruthy());
    expect(screen.getByLabelText('Token').props.value).toBe('');
  });

  it('permite apagar o token guardado', async () => {
    renderizarTela(<ConfigurarToken />);
    fireEvent.press(screen.getByText('Apagar token salvo'));

    await waitFor(() => expect(clearToken).toHaveBeenCalled());
  });

  it('esconde o valor digitado', () => {
    renderizarTela(<ConfigurarToken />);
    expect(screen.getByLabelText('Token').props.secureTextEntry).toBe(true);
  });
});
