/**
 * Setup global de Jest (móvil) — RNTL v14 + React 19.
 * React 19 exige IS_REACT_ACT_ENVIRONMENT=true para que `act()` haga flush de
 * updates; sin él, Zustand (useSyncExternalStore) no propaga a la UI en tests y
 * RNTL emite «not wrapped in act(...)». Lo activamos ANTES de montar cualquier
 * componente. React lo limpia entre act()s, así que es seguro aquí.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Locale determinista para los tests.
// El i18n resuelve el locale inicial con detectLocale(navigator.languages)
// y el producto deriva el locale del SO con override en Ajustes
// (ESTANDAR_INTERNACIONALIZACION §3). Node expone navigator.languages según
// el locale del sistema: en el runner de CI es ['en-US'] y en una máquina
// es-CO es ['es-CO'] — las aserciones de copy en español fallarían en CI.
// Se fija es-CO (mercado objetivo y SSOT de traducción) igual que en
// apps/web/tests/setup.ts.
{
  const g = globalThis as {
    navigator?: { languages?: readonly string[] };
  };
  const LANGUAGES = ['es-CO', 'es'];
  if (g.navigator) {
    Object.defineProperty(g.navigator, 'languages', {
      get: () => LANGUAGES,
      configurable: true,
    });
  } else {
    Object.defineProperty(globalThis, 'navigator', {
      value: { languages: LANGUAGES },
      configurable: true,
      writable: true,
    });
  }
}

// react-native-safe-area-context: en jest no hay medición nativa y el
// SafeAreaProvider traga TODO el árbol (children invisibles) → mock oficial
// con initialMetrics. Documentado por la propia librería.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock.tsx');
  // El mock exporta por default (spread de las APIs reales + métricas).
  return mock.default ?? mock;
});

export {};
