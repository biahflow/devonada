import { screen, waitFor } from '@testing-library/react-native';
import Painel from '../../../app/(tabs)/painel/index';
import { ChatScreen } from '../../screens/ChatScreen';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, requestMock } from '../api';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

/**
 * O 401 que sobra depois de a renovação silenciosa falhar.
 *
 * ANTES DO M8 este arquivo se chamava `sem-token.test.tsx` e vigiava outra
 * coisa: o app 401ava, dizia "sua sessão expirou" e não havia login para onde
 * mandar a pessoa — o que faltava era o token do beta colado no aparelho, e cada
 * tela precisava oferecer o caminho para a tela de token.
 *
 * Com conta de verdade (ADR 0012), 401 quase nunca chega à tela: `client.ts`
 * renova e repete. Quando a renovação falha, ele apaga a credencial e o
 * `_layout` redireciona. O que estas telas precisam garantir agora é o oposto do
 * que garantiam: NÃO oferecer ação nenhuma, porque não há ação que a pessoa
 * possa tomar, e continuar utilizáveis no instante entre o erro e o redirect.
 */
function sessaoAcabou() {
  requestMock.mockRejectedValue(
    new ApiError(401, 'Sua sessão expirou. Entre de novo para continuar.'),
  );
}

describe('401 que sobrevive à renovação', () => {
  it('o painel diz que a sessão terminou, sem mandar procurar nada', async () => {
    sessaoAcabou();
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('Sua sessão terminou')).toBeTruthy());
    expect(screen.getByText(/levando você de volta/i)).toBeTruthy();
  });

  it('não oferece "tentar de novo" — repetir só produziria outro 401', async () => {
    sessaoAcabou();
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('Sua sessão terminou')).toBeTruthy());
    expect(screen.queryByText('Tentar de novo')).toBeNull();
  });

  it('a tela de token do beta não existe mais', async () => {
    sessaoAcabou();
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('Sua sessão terminou')).toBeTruthy());
    expect(screen.queryByText('Configurar conexão')).toBeNull();
    expect(global.mockRouter.push).not.toHaveBeenCalledWith('/painel/token');
  });

  it('o chat continua utilizável com o 401 na tela', async () => {
    sessaoAcabou();
    renderizarTela(<ChatScreen />);

    await waitFor(() => expect(screen.getByLabelText('Mensagem')).toBeTruthy());
  });

  it('erro que não é 401 continua oferecendo tentar de novo', async () => {
    requestMock.mockRejectedValue(new ApiError(500, 'boom'));
    renderizarTela(<Painel />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});
