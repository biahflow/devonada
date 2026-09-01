import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { CANCELADO, ErroSocial, obterTokenSocial, provedoresDisponiveis } from '../social';

/**
 * A fronteira com os dois SDKs de identidade — o módulo de verdade, contra os
 * SDKs mockados em `jest.setup.js`.
 *
 * O QUE ESTA SUÍTE PROVA: que cada resposta possível dos SDKs vira a coisa certa
 * do lado do produto — token, `CANCELADO` ou `ErroSocial` com frase em pt-BR — e
 * que a disponibilidade é perguntada a quem sabe (o aparelho, no caso da Apple;
 * a configuração, no do Google).
 *
 * O QUE ELA NÃO PROVA: que a folha da Apple aparece, que a biometria roda, que o
 * Google Play Services responde. Nada disso existe sob jest, e só se confirma em
 * aparelho.
 */

const disponivelMock = AppleAuthentication.isAvailableAsync as jest.MockedFunction<
  typeof AppleAuthentication.isAvailableAsync
>;
const appleMock = AppleAuthentication.signInAsync as jest.MockedFunction<
  typeof AppleAuthentication.signInAsync
>;
const googleMock = GoogleSignin.signIn as jest.MockedFunction<typeof GoogleSignin.signIn>;

/** A plataforma é lida em tempo de execução; o teste a fixa para cada caso. */
function comPlataforma(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

const original = Platform.OS;

afterEach(() => {
  comPlataforma(original as 'ios' | 'android');
  jest.clearAllMocks();
  disponivelMock.mockResolvedValue(false);
  appleMock.mockResolvedValue({ identityToken: 'token-da-apple' } as never);
  googleMock.mockResolvedValue({ type: 'success', data: { idToken: 'token-do-google' } } as never);
});

describe('Quais provedores este aparelho tem', () => {
  it('a Apple entra quando o próprio aparelho diz que dá', async () => {
    comPlataforma('ios');
    disponivelMock.mockResolvedValue(true);
    expect(await provedoresDisponiveis()).toContain('apple');
  });

  it('a Apple não entra no Android, nem perguntando', async () => {
    comPlataforma('android');
    disponivelMock.mockResolvedValue(true);
    expect(await provedoresDisponiveis()).not.toContain('apple');
  });

  it('a Apple não entra quando o aparelho diz que não dá', async () => {
    // É o caso do Expo Go e do binário sem a capacidade assinada. Chutar por
    // `Platform.OS === 'ios'` deixaria o botão ligado justamente onde ele não
    // abre nada.
    comPlataforma('ios');
    disponivelMock.mockResolvedValue(false);
    expect(await provedoresDisponiveis()).not.toContain('apple');
  });

  it('o módulo ausente não estoura: vira botão que não aparece', async () => {
    comPlataforma('ios');
    disponivelMock.mockRejectedValue(new Error('módulo nativo ausente'));
    expect(await provedoresDisponiveis()).not.toContain('apple');
  });

  it('o Google entra com client id configurado', async () => {
    // O `jest.setup.js` preenche o client id, como o `.env` faria.
    expect(await provedoresDisponiveis()).toContain('google');
  });
});

describe('Pegar o token', () => {
  it('a Apple devolve o identityToken', async () => {
    expect(await obterTokenSocial('apple')).toBe('token-da-apple');
  });

  it('o Google devolve o idToken', async () => {
    expect(await obterTokenSocial('google')).toBe('token-do-google');
  });

  it('a Apple pede o escopo de e-mail e mais nada', async () => {
    // Nome e foto os dois SDKs oferecem; nenhuma tela do app os mostra, então
    // nem coletar (guardrail 5 — minimização).
    await obterTokenSocial('apple');
    expect(appleMock).toHaveBeenCalledWith({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  });

  it('cancelar na Apple é CANCELADO, não erro', async () => {
    appleMock.mockRejectedValue(Object.assign(new Error('x'), { code: 'ERR_REQUEST_CANCELED' }));
    expect(await obterTokenSocial('apple')).toBe(CANCELADO);
  });

  it('cancelar no Google é CANCELADO, não erro', async () => {
    googleMock.mockResolvedValue({ type: 'cancelled', data: null } as never);
    expect(await obterTokenSocial('google')).toBe(CANCELADO);
  });

  it('a Apple sem identityToken vira erro com frase de gente', async () => {
    appleMock.mockResolvedValue({ identityToken: null } as never);
    await expect(obterTokenSocial('apple')).rejects.toBeInstanceOf(ErroSocial);
  });

  it('o Google sem idToken vira erro com frase de gente', async () => {
    // Acontece quando o `webClientId` não bate com o projeto: o login funciona
    // e o token que o servidor precisa não vem.
    googleMock.mockResolvedValue({ type: 'success', data: { idToken: null } } as never);
    await expect(obterTokenSocial('google')).rejects.toBeInstanceOf(ErroSocial);
  });

  it('falha do SDK não vaza mensagem de SDK para a tela', async () => {
    appleMock.mockRejectedValue(new Error('AuthorizationError code=1000'));
    await expect(obterTokenSocial('apple')).rejects.toThrow(
      'Não deu para entrar pela Apple agora. Tente de novo.',
    );
  });
});
