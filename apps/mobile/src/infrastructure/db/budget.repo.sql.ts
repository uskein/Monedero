/**
 * SqlBudgetRepository — implementación móvil sobre SqlDbPort (HU-11·12).
 * `upsert` idempotente sobre UNIQUE(category_id, period): si ya existe fila
 * (aunque esté tombstonada) se reutiliza y revive, nunca se duplica.
 * `usage` suma los gastos (`type='expense'`) del periodo en la categoría.
 */
import type { Budget, BudgetInput } from '../../core/domain/budget';
import { BudgetInputSchema } from '../../core/domain/budget';
import type { BudgetEvent, BudgetRepository } from '../../core/ports/BudgetRepository';
import type { SqlDbPort, SqlRow } from './SqlDbPort';
import { uuid } from './sqlErrors';

interface Row extends SqlRow {
  id: string;
  category_id: string;
  period: string;
  amount_cents: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const SELECT_COLS = `id, category_id, period, amount_cents, created_at, updated_at, deleted_at`;

function toDomain(row: Row): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    period: row.period,
    amountCents: Number(row.amount_cents),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SqlBudgetRepository implements BudgetRepository {
  private readonly listeners = new Set<(e: BudgetEvent) => void>();

  constructor(private readonly db: SqlDbPort) {}

  private notify(id: string): void {
    for (const cb of this.listeners) cb({ scope: 'budget', type: 'budget:upserted', id });
  }

  subscribe(cb: (e: BudgetEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async get(categoryId: string, period: string): Promise<Budget | null> {
    const rows = await this.db.select<Row>(
      `SELECT ${SELECT_COLS} FROM budgets WHERE category_id = ? AND period = ? AND deleted_at IS NULL`,
      [categoryId, period],
    );
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async listByPeriod(period: string): Promise<Budget[]> {
    const rows = await this.db.select<Row>(
      `SELECT ${SELECT_COLS} FROM budgets WHERE period = ? AND deleted_at IS NULL ORDER BY created_at`,
      [period],
    );
    return rows.map(toDomain);
  }

  async upsert(input: BudgetInput): Promise<Budget> {
    const parsed = BudgetInputSchema.parse(input); // Zod ANTES de persistir (≤0 → VALIDATION_FAILED)
    const now = new Date().toISOString();
    const rows = await this.db.select<Row>(
      'SELECT id FROM budgets WHERE category_id = ? AND period = ?',
      [parsed.categoryId, parsed.period],
    );
    const existing = rows[0];
    if (existing) {
      await this.db.run(
        'UPDATE budgets SET amount_cents = ?, updated_at = ?, deleted_at = NULL WHERE id = ?',
        [parsed.amountCents, now, existing.id],
      );
      this.notify(existing.id);
      return this.requireGet(parsed.categoryId, parsed.period);
    }
    const id = uuid();
    await this.db.run(
      `INSERT INTO budgets (id, category_id, period, amount_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, parsed.categoryId, parsed.period, parsed.amountCents, now, now],
    );
    this.notify(id);
    return this.requireGet(parsed.categoryId, parsed.period);
  }

  async usage(categoryId: string, period: string): Promise<{ spentCents: number; budgetCents: number; ratio: number }> {
    const budget = await this.get(categoryId, period);
    const rows = await this.db.select<{ spent: number }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS spent FROM transactions
       WHERE deleted_at IS NULL AND type = 'expense' AND category_id = ? AND substr(date, 1, 7) = ?`,
      [categoryId, period],
    );
    const spentCents = Number(rows[0]?.spent ?? 0);
    const budgetCents = budget?.amountCents ?? 0;
    return { spentCents, budgetCents, ratio: budgetCents > 0 ? spentCents / budgetCents : 0 };
  }

  private async requireGet(categoryId: string, period: string): Promise<Budget> {
    const budget = await this.get(categoryId, period);
    if (!budget) throw new Error('BUDGET_NOT_PERSISTED');
    return budget;
  }
}
