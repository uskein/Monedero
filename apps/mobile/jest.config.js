const preset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
  // PBKDF2 120k con @noble (JS puro) en la bóveda: ~1,2 s por derive en jest
  // (entorno vm ~10× más lento que node para este código; asyncTick=100 mitiga).
  testTimeout: 30000,
  // @noble es ESM puro: solo necesita ESM→CJS. Pasarlo por babel-preset-expo
  // degrada ~10× su código caliente (SHA-256/PBKDF2), así que se transforma
  // con un plugin mínimo (sin babelrc/config del app). Primer patrón gana.
  transform: {
    'node_modules[\\\\/]@noble[\\\\/]': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
    ...preset.transform,
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@monedero/tokens$': '<rootDir>/../../shared/tokens/src/index.ts',
    '^@monedero/export-contract$': '<rootDir>/../../shared/export-contract/src/index.ts',
    '^@monedero/i18n$': '<rootDir>/../../shared/i18n/src/index.ts',
    '^@monedero/db$': '<rootDir>/../../shared/db/src/index.ts',
    '^@monedero/db/sqljs$': '<rootDir>/../../shared/db/src/sqljs.ts',
  },
  // pnpm aloja paquetes bajo .pnpm/<pkg>@v/node_modules/<pkg> y Windows usa "\":
  // el patrón debe admitir ambos separadores y el prefijo .pnpm/ para no ignorarlos.
  transformIgnorePatterns: [
    'node_modules[\\\\/](?!((\\.pnpm[\\\\/])?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?[\\\\/].*|@expo-google-fonts[\\\\/].*|react-navigation|@react-navigation[\\\\/].*|@sentry/react-native|native-base|react-native-svg|@noble[\\\\/].*)))',
  ],
};
