import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { env } from '../config/env';
import { rodandoNoExpoGo } from '../config/expoGo';
import type { ProvedorSocial } from '../api/types';

/**
 * O único lugar do app que fala com o Sign in with Apple e com o Google Sign-In.
 *
 * Mesmo papel que `src/compras/` tem para a loja e `src/notificacoes.ts` para as
 * notificações: o SDK fica atrás desta fronteira, e a tela conversa em termos do
 * produto — `provedoresDisponiveis`, `obterTokenSocial`.
 *
 * ISTO NÃO É EGRESS DE REDE DO APP no sentido do guardrail 2. A regra é que o
 * app só conhece a SUA API, e ela continua valendo: os dois SDKs falam com o
 * provedor de identidade do sistema, pelo mesmo canal que o app usa para pedir
 * permissão de câmera. O que sobe daqui para o nosso servidor é um ID token, e
 * ele viaja por `src/api/client.ts` como todo o resto.
 *
 * O QUE ESTE MÓDULO DEVOLVE É SÓ O TOKEN. Os dois SDKs entregam junto e-mail,
 * nome e foto; nada disso sai daqui. O e-mail que o servidor usa vem de dentro
 * do token, assinado — aceitar a versão que o aparelho digitou ao lado seria
 * deixar o cliente afirmar quem ele é (guardrail 1: o app não é fonte da
 * verdade). Nome e foto nenhuma tela mostra, então nem coletar (guardrail 5).
 *
 * NADA DISTO FUNCIONA NO EXPO GO, pelo mesmo motivo da compra in-app: os
 * módulos nativos não estão no binário. `provedoresDisponiveis()` devolve lista
 * vazia lá, e a tela de entrada mostra a legenda em vez de botão que não abre
 * nada.
 */

/** Cancelamento não é erro: quem desiste não precisa ler mensagem nenhuma. */
export const CANCELADO = null;

export class ErroSocial extends Error {}

/**
 * Carrega o SDK do Google SOB DEMANDA, dentro da função que o usa — nunca no
 * topo do arquivo.
 *
 * `@react-native-google-signin/google-signin` roda, EM ESCOPO DE MÓDULO,
 * `TurboModuleRegistry.getEnforcing('RNGoogleSignin')`
 * (`lib/module/spec/NativeGoogleSignin.js`), que lança exceção SÍNCRONA
 * quando o módulo nativo não está linkado — e o Expo Go não o linka. Um
 * `import` estático no topo deste arquivo bastava para derrubar o app inteiro
 * no boot, porque `src/hooks/useConta.ts` importa `../social`, e seis telas
 * importam `useConta`. `require()` aqui adia essa avaliação até o instante em
 * que o Google realmente for usado — e nesse ponto, no Expo Go, já nem se
 * chega: `provedoresDisponiveis()` tira o Google da lista antes.
 *
 * `expo-iap` e `expo-apple-authentication` NÃO precisam deste tratamento:
 * o primeiro resolve o módulo nativo por `Proxy` preguiçoso, o segundo usa
 * `requireOptionalNativeModule` com um stub seguro — nenhum dos dois lança no
 * import. Se um dia "arrumar" este import de volta para o topo por
 * consistência estética, o app volta a morrer no Expo Go.
 */
function googleSignInSdk(): typeof import('@react-native-google-signin/google-signin') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- import tardio de propósito, ver comentário desta função
  return require('@react-native-google-signin/google-signin');
}

/**
 * `configure` é idempotente e barato, mas precisa ter rodado antes do
 * `signIn` — chamá-lo na hora do toque evita um efeito de inicialização no
 * `_layout` para um caminho que a maioria das sessões não usa.
 */
function configurarGoogle() {
  const { GoogleSignin } = googleSignInSdk();
  GoogleSignin.configure({
    // O `webClientId` é o que vira audiência do `idToken` nas DUAS plataformas.
    // Sem ele o token chega ao servidor com `aud` que a configuração não
    // conhece, e a recusa parece defeito de servidor.
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId || undefined,
    // O padrão da biblioteca já é e-mail e perfil; declarar só o e-mail é o
    // mínimo de que o servidor precisa para identificar a conta.
    scopes: ['email'],
  });
}

/**
 * Quais botões a tela de entrada pode ligar NESTE aparelho.
 *
 * Assíncrona porque a resposta da Apple é: `isAvailableAsync()` é o que sabe se
 * o aparelho tem iOS 13+, se o binário tem a capacidade assinada e se não é
 * Expo Go. Chutar por `Platform.OS === 'ios'` acertaria na maioria e deixaria o
 * botão ligado, sem para onde ir, justamente nos aparelhos onde ele não abre.
 */
export async function provedoresDisponiveis(): Promise<ProvedorSocial[]> {
  const disponiveis: ProvedorSocial[] = [];

  if (Platform.OS === 'ios') {
    try {
      if (await AppleAuthentication.isAvailableAsync()) disponiveis.push('apple');
    } catch {
      // Módulo ausente (Expo Go) não é erro a mostrar: é botão que não aparece.
    }
  }

  // O Google não tem o que perguntar ao aparelho — o que falta, quando falta, é
  // o client id. Sem ele o fluxo abriria a tela do Google para terminar em
  // recusa, e a legenda diz a verdade mais cedo. E no Expo Go o módulo nativo
  // nem existe: oferecer o botão terminaria numa exceção, não numa recusa.
  if (env.googleWebClientId && !rodandoNoExpoGo()) disponiveis.push('google');

  return disponiveis;
}

/**
 * Abre o fluxo do provedor e devolve o ID token — ou `CANCELADO`.
 *
 * O TOKEN NÃO É GUARDADO em lugar nenhum do aparelho. Ele vale minutos, serve
 * para uma troca só, e o que persiste depois disso é a sessão do nosso servidor,
 * no `expo-secure-store` como sempre.
 */
export async function obterTokenSocial(provedor: ProvedorSocial): Promise<string | null> {
  return provedor === 'apple' ? apple() : google();
}

async function apple(): Promise<string | null> {
  try {
    const credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });

    if (!credencial.identityToken) {
      throw new ErroSocial('A Apple não devolveu sua identificação. Tente de novo.');
    }
    return credencial.identityToken;
  } catch (e) {
    if (cancelou(e)) return CANCELADO;
    if (e instanceof ErroSocial) throw e;
    throw new ErroSocial('Não deu para entrar pela Apple agora. Tente de novo.');
  }
}

async function google(): Promise<string | null> {
  try {
    const { GoogleSignin } = googleSignInSdk();
    configurarGoogle();
    // Só no Android tem o que conferir; no iOS a chamada resolve direto.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const resposta = await GoogleSignin.signIn();
    if (resposta.type !== 'success') return CANCELADO;

    const token = resposta.data.idToken;
    if (!token) {
      // Acontece quando o `webClientId` não bate com o projeto: o login
      // funciona e o token que o servidor precisa não vem.
      throw new ErroSocial('O Google não devolveu sua identificação. Tente de novo.');
    }
    return token;
  } catch (e) {
    if (cancelou(e)) return CANCELADO;
    if (e instanceof ErroSocial) throw e;
    throw new ErroSocial('Não deu para entrar pelo Google agora. Tente de novo.');
  }
}

/**
 * Desistir é um caminho normal, e cada SDK o conta de um jeito: a Apple levanta
 * exceção com código, o Google devolve `type: 'cancelled'` — e a versão antiga
 * dele levantava com `SIGN_IN_CANCELLED`. Tratar os três aqui evita que um
 * "Não deu para entrar" apareça para quem só fechou a folha.
 */
function cancelou(e: unknown): boolean {
  const { statusCodes } = googleSignInSdk();
  const codigo = (e as { code?: string } | null)?.code;
  return codigo === 'ERR_REQUEST_CANCELED' || codigo === statusCodes.SIGN_IN_CANCELLED;
}
