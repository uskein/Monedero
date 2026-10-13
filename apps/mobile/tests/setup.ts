/**
 * Setup global de Jest (móvil) — RNTL v14 + React 19.
 * React 19 exige IS_REACT_ACT_ENVIRONMENT=true para que `act()` haga flush de
 * updates; sin él, Zustand (useSyncExternalStore) no propaga a la UI en tests y
 * RNTL emite «not wrapped in act(...)». Lo activamos ANTES de montar cualquier
 * componente. React lo limpia entre act()s, así que es seguro aquí.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// react-native-safe-area-context: en jest no hay medición nativa y el
// SafeAreaProvider traga TODO el árbol (children invisibles) → mock oficial
// con initialMetrics. Documentado por la propia librería.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock.tsx');
  // El mock exporta por default (spread de las APIs reales + métricas).
  return mock.default ?? mock;
});

export {};
