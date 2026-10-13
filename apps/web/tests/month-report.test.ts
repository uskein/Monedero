/**
 * Tests TDD — computeMonthReport (HU-13 · tarea 6.1): agregación mensual,
 * solo gastos por categoría desc, transferencias y tombstones fuera.
 */
import { describe, it, expect } from 'vitest';
import { computeMonthReport, type MonthReportTx } from '../src/data/domain/monthReport';

function tx(overrides: Partial<MonthReportTx> = {}): MonthReportTx {
  return {
    type: 'expense',
    amountCents: 10_000,
    categoryId: 'cat-comida',
    date: '2026-10-05',
    deletedAt: null,
    ...overrides,
  };
}

describe('computeMonthReport (HU-13)', () => {
  it('mes sin movimientos → totales en cero y byCategory vacío', () => {
    const report = computeMonthReport('2026-10', []);
    expect(report).toEqual({
      month: '2026-10',
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
      byCategory: [],
    });
  });

  it('agrega ingresos, gastos y balance del MES exacto', () => {
    const report = computeMonthReport('2026-10', [
      tx({ type: 'income', amountCents: 500_000, categoryId: null, date: '2026-10-06' }),
      tx({ amountCents: 30_000 }),
      tx({ amountCents: 20_000, categoryId: 'cat-ocio', date: '2026-10-20' }),
      tx({ amountCents: 99_000, date: '2026-11-02' }), // otro mes → fuera
    ]);
    expect(report.incomeCents).toBe(500_000);
    expect(report.expenseCents).toBe(50_000);
    expect(report.balanceCents).toBe(450_000);
  });

  it('byCategory: solo gastos, ordenado desc con porcentajes', () => {
    const report = computeMonthReport('2026-10', [
      tx({ amountCents: 25_000 }),
      tx({ amountCents: 15_000, categoryId: 'cat-ocio' }),
      tx({ amountCents: 10_000 }),
      tx({ type: 'income', amountCents: 80_000, categoryId: 'cat-salario' }), // ingreso no entra
    ]);
    expect(report.byCategory).toEqual([
      { categoryId: 'cat-comida', amountCents: 35_000, percent: 70 },
      { categoryId: 'cat-ocio', amountCents: 15_000, percent: 30 },
    ]);
  });

  it('gasto sin categoría → categoryId "" y desempate estable por nombre', () => {
    const report = computeMonthReport('2026-10', [
      tx({ amountCents: 10_000, categoryId: null }),
      tx({ amountCents: 10_000, categoryId: null }),
      tx({ amountCents: 10_000, categoryId: 'cat-casa' }),
    ]);
    expect(report.byCategory.map((c) => c.categoryId)).toEqual(['', 'cat-casa']);
    // '' acumula los dos gastos sin categoría: 20.000 de 30.000 = 66,67 %.
    expect(report.byCategory[0]?.amountCents).toBe(20_000);
    expect(report.byCategory[0]?.percent).toBeCloseTo((20_000 / 30_000) * 100, 5);
  });

  it('transferencias y tombstones quedan fuera del reporte', () => {
    const report = computeMonthReport('2026-10', [
      tx({ type: 'transfer', amountCents: 40_000 }),
      tx({ amountCents: 70_000, deletedAt: '2026-10-10T12:00:00.000Z' }),
      tx({ amountCents: 10_000 }),
    ]);
    expect(report.expenseCents).toBe(10_000);
    expect(report.byCategory).toHaveLength(1);
  });

  it('sin gastos los porcentajes son 0 (sin división por cero)', () => {
    const report = computeMonthReport('2026-10', [
      tx({ type: 'income', amountCents: 50_000, categoryId: null }),
    ]);
    expect(report.byCategory).toEqual([]);
    expect(report.balanceCents).toBe(50_000);
  });
});
