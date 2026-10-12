// Babel — Expo SDK 57. Orden obligatorio de plugins cuando se añada Reanimated:
// el plugin de react-native-reanimated va SIEMPRE el último (ESTRUCTURA_DIRECTORIOS §1).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // reanimated plugin se añadirá aquí al instalarse (S3): 'react-native-reanimated/plugin'
    ],
  };
};
