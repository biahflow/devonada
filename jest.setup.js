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
