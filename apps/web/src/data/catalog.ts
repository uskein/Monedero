/**
 * Catálogo por defecto (BP-05 · seedDefaults) — categorías y cuenta raíz que
 * crea la semilla. Compartido por TransactionsScreen (alta BP-05) y
 * DashboardScreen (últimos movimientos BP-03) hasta que exista el CRUD de
 * categorías/cuentas (no está en el MVP).
 */
export const DEFAULT_CATEGORIES: Array<{ id: string; name: string }> = [
  { id: 'cat-comida', name: 'Comida' },
  { id: 'cat-transporte', name: 'Transporte' },
  { id: 'cat-casa', name: 'Casa' },
  { id: 'cat-salud', name: 'Salud' },
  { id: 'cat-ocio', name: 'Ocio' },
  { id: 'cat-otros', name: 'Otros' },
  { id: 'cat-salario', name: 'Salario' },
  { id: 'cat-ingresos-otros', name: 'Otros ingresos' },
];

export const DEFAULT_ACCOUNTS: Array<{ id: string; name: string }> = [
  { id: 'acc-efectivo', name: 'Efectivo' },
];
