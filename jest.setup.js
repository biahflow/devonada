/**
 * Ícones do @expo/vector-icons carregam a fonte de forma assíncrona e chamam
 * setState depois que o teste terminou, produzindo warning de act() em todo
 * teste que renderize um ícone. Em teste, o glyph não é o que se verifica —
 * o que importa é o accessibilityLabel do controle em volta.
 */
jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }) => React.createElement(Text, null, `icon:${name}`),
  };
});

/**
 * Notificações. O módulo nativo não resolve sob jest, e o que os testes
 * verificam é a LÓGICA de agendamento (hora válida, instante local), não a API
 * do sistema operacional. Disparo real só se confirma em aparelho.
 */
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

/**
 * Ids de produto da assinatura. `src/compras/` devolve lista vazia sem eles —
 * de propósito, porque um app publicado sem produto configurado não deve
 * inventar um sku —, e sem estas linhas todo teste de preço exercitaria o
 * caminho de "loja sem plano" achando que exercita o caminho feliz.
 */
process.env.EXPO_PUBLIC_PRODUTO_ASSINATURA_IOS = 'devonada.assinatura.mensal';
process.env.EXPO_PUBLIC_PRODUTO_ASSINATURA_ANDROID = 'devonada.assinatura.mensal';

/**
 * Loja de aplicativos. O módulo nativo não existe sob jest — nem no Expo Go, o
 * que é o motivo de o M9 exigir *development build*.
 *
 * O que a suíte verifica aqui é o que a TELA mostra e a ORDEM do ciclo de
 * compra (o backend confirma antes de `finishTransaction`), não a folha de
 * pagamento do sistema. Compra de verdade só se prova em sandbox, no aparelho.
 *
 * `fetchProducts` devolve um plano por padrão para o preço aparecer no botão;
 * o teste que quer loja vazia sobrescreve.
 */
jest.mock('expo-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(true),
  fetchProducts: jest.fn().mockResolvedValue([
    { id: 'devonada.assinatura.mensal', displayPrice: 'R$ 19,90', title: 'devo.nada' },
  ]),
  requestPurchase: jest.fn().mockResolvedValue(undefined),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
  deepLinkToSubscriptions: jest.fn().mockResolvedValue(undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
}));

/**
 * Login social. Os dois módulos nativos não existem sob jest — nem no Expo Go,
 * o que é o motivo de o M13 continuar exigindo *development build*.
 *
 * O QUE A SUÍTE VERIFICA AQUI é o que a TELA faz com cada resposta possível do
 * provedor: token, cancelamento e falha. Que a Apple mostre a folha certa só se
 * prova em aparelho, e o teste não finge o contrário.
 *
 * `isAvailableAsync` devolve `false` POR PADRÃO, que é o estado do Expo Go e o
 * da máquina de quem roda a suíte. O teste que quer o botão ligado sobrescreve —
 * o mesmo desenho do `fetchProducts` da loja.
 */
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  signInAsync: jest.fn().mockResolvedValue({ identityToken: 'token-da-apple' }),
  AppleAuthenticationScope: { EMAIL: 0, FULL_NAME: 1 },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      type: 'success',
      data: { idToken: 'token-do-google' },
    }),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

/**
 * Client id do Google. `src/social/` devolve lista sem o Google sem ele — de
 * propósito, porque abrir a folha do provedor para terminar em recusa é pior
 * que dizer antes. Sem esta linha, todo teste do botão do Google exercitaria o
 * caminho de "não configurado" achando que exercita o caminho feliz.
 */
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'cliente-web-de-teste.apps.googleusercontent.com';

/**
 * URLs das páginas legais. Sem elas, `src/config/env.ts` deixa `urlTermos` e
 * `urlPrivacidade` vazias e a linha legal da tela de entrada vira texto — então
 * todo teste do link exercitaria o caminho de "não configurado" achando que
 * exercita o caminho feliz. Mesmo desenho dos ids de produto da assinatura.
 */
process.env.EXPO_PUBLIC_URL_TERMOS = 'https://exemplo.test/termos';
process.env.EXPO_PUBLIC_URL_PRIVACIDADE = 'https://exemplo.test/privacidade';

/**
 * Navegação. Os testes de tela verificam o que o usuário LÊ, não para onde o
 * app navega — por isso as funções são espiões vazios. `mockRouter` fica
 * exposto para o teste que precise afirmar que uma ação leva a algum lugar.
 */
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

/** Parâmetro de rota. O teste ajusta antes de renderizar uma tela com [id]. */
let mockParams = {};

global.mockRouter = mockRouter;
global.definirParametrosDeRota = (params) => {
  mockParams = params;
};

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children }) => React.createElement(View, null, children);

  return {
    useRouter: () => global.mockRouter,
    useLocalSearchParams: () => mockParams,
    usePathname: () => '/',
    Link: Passthrough,
    Stack: Passthrough,
    Tabs: Passthrough,
    Slot: Passthrough,
  };
});

/**
 * Rede. `request` e `upload` são o único egress do app (guardrail 2), então
 * mocká-los aqui corta TODA a rede de uma vez — nenhum teste consegue tocar a
 * internet sem alterar este arquivo.
 */
jest.mock('./src/api/client', () => {
  const real = jest.requireActual('./src/api/client');
  return {
    ...real,
    request: jest.fn(),
    upload: jest.fn(),
  };
});

beforeEach(() => {
  mockParams = {};
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
});
