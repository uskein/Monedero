module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
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
    'node_modules[\\\\/](?!((\\.pnpm[\\\\/])?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?[\\\\/].*|@expo-google-fonts[\\\\/].*|react-navigation|@react-navigation[\\\\/].*|@sentry/react-native|native-base|react-native-svg)))',
  ],
};
