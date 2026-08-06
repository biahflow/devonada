module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin é exigido pelo react-native-reanimated 4 e
    // PRECISA ser o último plugin da lista. Fora de ordem ele falha em runtime,
    // sem erro de build — não reordene.
    plugins: ['react-native-worklets/plugin'],
  };
};
