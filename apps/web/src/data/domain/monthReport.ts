/**
 * MonthReport — dominio móvil (HU-13 · BP-07). Espejo en apps/web.
 * Agregación mensual pura (sin BD): ingresos, gastos, balance y desglose por
 * categoría de GASTOS ordenado descendente con porcentaje sobre el gasto total.
 * Reglas: solo type income/expense (las transferencias NO son ingreso ni gasto),
 * tombstones (deletedAt) excluidos, categoría sin asignar → categoryId ''.
 */
export interface MonthReportTx {
  type: 'income' | 'expense' | 'transfer';
  amountCents: number;
  categoryId: string | null;
  date: string; // 'YYYY-MM-DD'
  deletedAt: string | null;
}

export interface MonthReportCategory {
  categoryId: string; // '' = sin categoría
  amountCents: number;
  /** 0–100 del gasto total (0 si no hay gastos). */
  percent: number;
}

export interface MonthReport {
  month: string; // 'YYYY-MM'
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  byCategory: MonthReportCategory[];
}

/**
 * Computa el reporte del mes (HU-13, TDD 6.1). Puro y sin efectos: la UI
 * resuelve nombres de categoría con su catálogo y pinta donut + tabla.
 */
export function computeMonthReport(month: string, transactions: MonthReportTx[]): MonthReport {
  const ofMonth = transactions.filter((tx) => !tx.deletedAt && tx.date.slice(0, 7) === month);

  let incomeCents = 0;
  let expenseCents = 0;
  const byCategoryMap = new Map<string, number>();

  for (const tx of ofMonth) {
    if (tx.type === 'income') {
      incomeCents += tx.amountCents;
    } else if (tx.type === 'expense') {
      expenseCents += tx.amountCents;
      const key = tx.categoryId ?? '';
      byCategoryMap.set(key, (byCategoryMap.get(key) ?? 0) + tx.amountCents);
    }
  }

  const byCategory: MonthReportCategory[] = [...byCategoryMap.entries()]
    .map(([categoryId, amountCents]) => ({
      categoryId,
      amountCents,
      percent: expenseCents > 0 ? (amountCents / expenseCents) * 100 : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents || a.categoryId.localeCompare(b.categoryId));

  return {
    month,
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    byCategory,
  };
}
