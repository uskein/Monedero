/**
 * Catálogo por defecto (categorías y cuentas seed) — SSOT de la UI móvil.
 * Espejo de apps/web/src/data/catalog.ts: TransactionsScreen (BP-04/BP-05) y
 * DashboardScreen (BP-03) comparten el MISMO mapa de nombres de categoría.
 */
import type { Option } from './TransactionForm';

export const DEFAULT_CATEGORIES: Option[] = [
  { id: 'cat-comida', name: 'Comida' },
  { id: 'cat-transporte', name: 'Transporte' },
  { id: 'cat-casa', name: 'Casa' },
  { id: 'cat-salud', name: 'Salud' },
  { id: 'cat-ocio', name: 'Ocio' },
  { id: 'cat-otros', name: 'Otros' },
  { id: 'cat-salario', name: 'Salario' },
  { id: 'cat-ingresos-otros', name: 'Otros ingresos' },
];

export const DEFAULT_ACCOUNTS: Option[] = [
  { id: 'acc-efectivo', name: 'Efectivo' },
  { id: 'acc-ahorro', name: 'Ahorro' },
];

export const CATEGORY_NAMES: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.name]),
);
