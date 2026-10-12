/**
 * Setup global de Jest (móvil) — RNTL v14 + React 19.
 * React 19 exige IS_REACT_ACT_ENVIRONMENT=true para que `act()` haga flush de
 * updates; sin él, Zustand (useSyncExternalStore) no propaga a la UI en tests y
 * RNTL emite «not wrapped in act(...)». Lo activamos ANTES de montar cualquier
 * componente. React lo limpia entre act()s, así que es seguro aquí.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export {};
