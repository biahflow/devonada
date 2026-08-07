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
process.env.EXPO_PUBLIC_PRODUTO_ASSINATURA_IOS = 'buddy.assinatura.mensal';
process.env.EXPO_PUBLIC_PRODUTO_ASSINATURA_ANDROID = 'buddy.assinatura.mensal';

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
    { id: 'buddy.assinatura.mensal', displayPrice: 'R$ 19,90', title: 'Buddy' },
  ]),
  requestPurchase: jest.fn().mockResolvedValue(undefined),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
  deepLinkToSubscriptions: jest.fn().mockResolvedValue(undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
}));

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
