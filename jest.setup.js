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
