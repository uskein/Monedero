/**
 * Tests TDD — evaluateBudgets (HU-12 · tarea 5.3): umbrales serenos 80/100,
 * guardia de presupuesto 0 y pureza (sin BD, sin efectos).
 */
import { describe, it, expect } from 'vitest';
import {
  BUDGET_EXCEEDED_RATIO,
  BUDGET_WARN_RATIO,
  currentPeriod,
  evaluateBudgets,
  type BudgetUsage,
} from '../src/data/domain/budgets';

function usage(spentCents: number, budgetCents: number, categoryId = 'cat-comida'): BudgetUsage {
  return { categoryId, period: '2026-10', spentCents, budgetCents };
}

describe('evaluateBudgets (HU-12, umbrales 80/100)', () => {
  it('expone los umbrales oficiales 0.8 y 1', () => {
    expect(BUDGET_WARN_RATIO).toBe(0.8);
    expect(BUDGET_EXCEEDED_RATIO).toBe(1);
  });

  it('79 % → ok; 80 % (exacto) → warn; 99 % → warn', () => {
    const [a, b, c] = evaluateBudgets([
      usage(79_000, 100_000),
      usage(80_000, 100_000),
      usage(99_000, 100_000),
    ]);
    expect(a?.level).toBe('ok');
    expect(b?.level).toBe('warn');
    expect(c?.level).toBe('warn');
  });

  it('100 % (exacto) → exceeded; pasado el tope → exceeded saturado', () => {
    const [a, b] = evaluateBudgets([usage(100_000, 100_000), usage(150_000, 100_000)]);
    expect(a?.level).toBe('exceeded');
    expect(b?.level).toBe('exceeded');
    expect(b?.ratio).toBeCloseTo(1.5);
  });

  it('presupuesto 0 → ratio 0 y ok (sin división por cero)', () => {
    const [only] = evaluateBudgets([usage(50_000, 0)]);
    expect(only?.ratio).toBe(0);
    expect(only?.level).toBe('ok');
  });

  it('sin gastos → ratio 0 y ok', () => {
    const [only] = evaluateBudgets([usage(0, 100_000)]);
    expect(only?.ratio).toBe(0);
    expect(only?.level).toBe('ok');
  });

  it('es puro: conserva orden y campos, no muta la entrada', () => {
    const input = [usage(90_000, 100_000, 'cat-comida'), usage(10_000, 100_000, 'cat-ocio')];
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = evaluateBudgets(input);
    expect(out.map((e) => e.categoryId)).toEqual(['cat-comida', 'cat-ocio']);
    expect(out[0]?.level).toBe('warn');
    expect(out[1]?.level).toBe('ok');
    expect(input).toEqual(snapshot);
  });
});

describe('currentPeriod', () => {
  it('devuelve YYYY-MM del mes LOCAL (sin deriva UTC)', () => {
    expect(currentPeriod(new Date(2026, 0, 31, 23, 59))).toBe('2026-01'); // mes 1 sin cero inicial
    expect(currentPeriod(new Date(2026, 11, 1, 0, 0))).toBe('2026-12');
    expect(currentPeriod(new Date(2026, 8, 15))).toBe('2026-09');
  });
});
