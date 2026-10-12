/**
 * Puerto BudgetRepository (HU-11·12) — móvil. Fuente: CONTRATOS_API.md §1.2.
 * UNIQUE(category_id, period) → `upsert` idempotente (crea o actualiza el
 * tope del mes; F4 «duplicado → editar existente» se resuelve en el store/UI).
 */
import type { Budget, BudgetInput } from '../domain/budget';

export type Unsubscribe = () => void;

export type BudgetEvent = {
  scope: 'budget';
  type: 'budget:upserted';
  id: string;
};

export interface BudgetRepository {
  get(categoryId: string, period: string): Promise<Budget | null>;
  /** Topes del mes (BP-06 lista). */
  listByPeriod(period: string): Promise<Budget[]>;
  upsert(input: BudgetInput): Promise<Budget>;
  /** Gasto acumado del mes en la categoría + tope y ratio (HU-12). */
  usage(categoryId: string, period: string): Promise<{ spentCents: number; budgetCents: number; ratio: number }>;
  subscribe(cb: (e: BudgetEvent) => void): Unsubscribe;
}
