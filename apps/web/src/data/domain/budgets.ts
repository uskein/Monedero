/**
 * Budget — dominio PWA (HU-11·12 · E6).
 * Espejo de apps/mobile/src/core/domain/budget.ts. Fuente: MODELO_DE_DATOS §3 ·
 * BLUEPRINTS BP-06 · FLUJOS F4.
 * Reglas: importe > 0 en centavos (≤ 0 → VALIDATION_FAILED vía Zod), periodo
 * YYYY-MM, UNIQUE(category_id, period) → upsert idempotente en la BD.
 * Umbrales serenos (HU-12): 80 % aviso (accent) · 100 % tope (danger); el
 * `--cs-danger` SOLO pinta la barra al tope, nunca un gasto normal (SSOT).
 */
import { z } from 'zod';

export interface Budget {
  id: string;
  categoryId: string;
  /** 'YYYY-MM' (CHECK GLOB en BD). */
  period: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BudgetInput {
  categoryId: string;
  period: string;
  amountCents: number;
}

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export const BudgetInputSchema = z.object({
  categoryId: z.string().min(1),
  period: z.string().regex(PERIOD, 'VALIDATION_FAILED'),
  amountCents: z
    .number()
    .int('MONEY_NOT_INTEGER')
    // HU-11: importe ≤ 0 → VALIDATION_FAILED.
    .refine((v) => v > 0, { message: 'VALIDATION_FAILED' }),
});

export type BudgetLevel = 'ok' | 'warn' | 'exceeded';

export const BUDGET_WARN_RATIO = 0.8;
export const BUDGET_EXCEEDED_RATIO = 1;

export interface BudgetUsage {
  categoryId: string;
  period: string;
  spentCents: number;
  budgetCents: number;
}

export interface BudgetEvaluation extends BudgetUsage {
  /** spentCents / budgetCents (0 si no hay tope). */
  ratio: number;
  level: BudgetLevel;
}

/**
 * Evalúa el uso de cada presupuesto contra sus umbrales (HU-12, TDD 5.3).
 * Puro y sin BD: la UI pinta `level` con `.progress` semántico de BP-06 y el
 * store emite `budget:exceeded` para el toast sereno de 4000 ms.
 */
export function evaluateBudgets(items: BudgetUsage[]): BudgetEvaluation[] {
  return items.map((item) => {
    const ratio = item.budgetCents > 0 ? item.spentCents / item.budgetCents : 0;
    const level: BudgetLevel =
      ratio >= BUDGET_EXCEEDED_RATIO ? 'exceeded' : ratio >= BUDGET_WARN_RATIO ? 'warn' : 'ok';
    return { ...item, ratio, level };
  });
}
