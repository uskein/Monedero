/**
 * Catálogo por defecto (categorías y cuentas seed) — SSOT de la UI móvil.
 * Espejo de apps/web/src/data/catalog.ts: TransactionsScreen (BP-04/BP-05) y
 * DashboardScreen (BP-03) comparten el MISMO mapa de nombres de categoría.
 */
import type { Option } from './TransactionForm';

/** Categorías seed (espejo del seed de la BD en createDevRepository). */
export const DEFAULT_CATEGORIES: Option[] = [
  { id: 'cat-comida', name: 'Comida', type: 'expense' },
  { id: 'cat-transporte', name: 'Transporte', type: 'expense' },
  { id: 'cat-casa', name: 'Casa', type: 'expense' },
  { id: 'cat-salud', name: 'Salud', type: 'expense' },
  { id: 'cat-ocio', name: 'Ocio', type: 'expense' },
  { id: 'cat-otros', name: 'Otros', type: 'expense' },
  { id: 'cat-salario', name: 'Salario', type: 'income' },
  { id: 'cat-ingresos-otros', name: 'Otros ingresos', type: 'income' },
];

export const DEFAULT_ACCOUNTS: Option[] = [
  { id: 'acc-efectivo', name: 'Efectivo' },
  { id: 'acc-ahorro', name: 'Ahorro' },
];

export const CATEGORY_NAMES: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.name]),
);
