import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import Painel from '../../../app/(tabs)/painel/index';
import { ChatScreen } from '../../screens/ChatScreen';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, requestMock } from '../api';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

/** O 401 que o backend devolve quando o aparelho não tem o token guardado. */
function semToken() {
  requestMock.mockRejectedValue(
    new ApiError(401, 'Sua sessão expirou. Entre de novo para continuar.'),
  );
}

/**
 * O bug de origem: o app 401ava no chat e a pessoa lia "sua sessão expirou" sem
 * ter onde entrar de novo — não existe login no beta, o que falta é o token do
 * aparelho. A saída precisa existir em TODA tela, não só no painel.
 */
describe('401 sempre oferece saída', () => {
  it('o chat mostra como configurar a conexão, em vez de só pintar o erro', async () => {
    semToken();
    renderizarTela(<ChatScreen />);

    const botao = await screen.findByText('Configurar conexão');
    fireEvent.press(botao);

    expect(global.mockRouter.push).toHaveBeenCalledWith('/painel/token');
  });

  it('o chat continua utilizável com o 401 na tela', async () => {
    semToken();
    renderizarTela(<ChatScreen />);

    await screen.findByText('Configurar conexão');
    expect(screen.getByLabelText('Mensagem')).toBeTruthy();
  });

  it('o painel não repete "sessão expirou" — diz que falta o token', async () => {
    semToken();
    renderizarTela(<Painel />);

    await waitFor(() =>
      expect(screen.getByText('O app não está conectado ao servidor')).toBeTruthy(),
    );
    expect(screen.queryByText(/sessão expirou/i)).toBeNull();
    expect(screen.getByText('Configurar conexão')).toBeTruthy();
  });

  it('erro que não é 401 não oferece configurar conexão', async () => {
    requestMock.mockRejectedValue(new ApiError(500, 'boom'));
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
    expect(screen.queryByText('Configurar conexão')).toBeNull();
  });
});
