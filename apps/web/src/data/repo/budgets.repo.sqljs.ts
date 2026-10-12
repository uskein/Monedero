/**
 * BudgetRepository — implementación sql.js (PWA, HU-11·12).
 * Puerto: CONTRATOS_API.md §1.2 · Semántica idéntica al repositorio móvil.
 * `upsert` idempotente sobre UNIQUE(category_id, period): si ya existe fila
 * (aunque esté tombstonada) se reutiliza y revive, nunca se duplica.
 */
import type { Database } from 'sql.js';
import type { Budget, BudgetInput } from '../domain/budgets';
import { BudgetInputSchema } from '../domain/budgets';
import { uuid } from './sqlErrors';

type Unsubscribe = () => void;

interface Row {
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

export class SqlJsBudgetRepository {
  private readonly listeners = new Set<(e: { type: 'budget:upserted' }) => void>();

  constructor(private readonly db: Database) {}

  private notify(): void {
    for (const cb of this.listeners) cb({ type: 'budget:upserted' });
  }

  subscribe(cb: (e: { type: 'budget:upserted' }) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private selectRows(sql: string, params: (string | number)[] = []): Row[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const out: Row[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as unknown as Row);
      return out;
    } finally {
      stmt.free();
    }
  }

  async get(categoryId: string, period: string): Promise<Budget | null> {
    const row = this.selectRows(
      `SELECT ${SELECT_COLS} FROM budgets WHERE category_id = ? AND period = ? AND deleted_at IS NULL`,
      [categoryId, period],
    )[0];
    return row ? toDomain(row) : null;
  }

  async listByPeriod(period: string): Promise<Budget[]> {
    const rows = this.selectRows(
      `SELECT ${SELECT_COLS} FROM budgets WHERE period = ? AND deleted_at IS NULL ORDER BY created_at`,
      [period],
    );
    return rows.map(toDomain);
  }

  async upsert(input: BudgetInput): Promise<Budget> {
    const parsed = BudgetInputSchema.parse(input); // Zod ANTES de persistir (≤0 → VALIDATION_FAILED)
    const now = new Date().toISOString();
    const existing = this.selectRows('SELECT id FROM budgets WHERE category_id = ? AND period = ?', [
      parsed.categoryId,
      parsed.period,
    ])[0];
    if (existing) {
      this.db.run('UPDATE budgets SET amount_cents = ?, updated_at = ?, deleted_at = NULL WHERE id = ?', [
        parsed.amountCents,
        now,
        existing.id,
      ]);
      this.notify();
      return this.requireGet(parsed.categoryId, parsed.period);
    }
    const id = uuid();
    this.db.run(
      `INSERT INTO budgets (id, category_id, period, amount_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, parsed.categoryId, parsed.period, parsed.amountCents, now, now],
    );
    this.notify();
    return this.requireGet(parsed.categoryId, parsed.period);
  }

  async usage(categoryId: string, period: string): Promise<{ spentCents: number; budgetCents: number; ratio: number }> {
    const budget = await this.get(categoryId, period);
    const rows = this.selectRows(
      `SELECT COALESCE(SUM(amount_cents), 0) AS spent FROM transactions
       WHERE deleted_at IS NULL AND type = 'expense' AND category_id = ? AND substr(date, 1, 7) = ?`,
      [categoryId, period],
    ) as unknown as Array<{ spent: number }>;
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
