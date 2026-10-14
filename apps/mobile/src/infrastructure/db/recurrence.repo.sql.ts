/**
 * SqlRecurrenceRepository — implementación sobre SqlDbPort (v0.3.0).
 * Tumbstone idempotente: `remove` solo marca `deleted_at`; `update` con
 * `active` pausa/reanuda sin tocar `last_generated_period` (el ancla de
 * idempotencia sobrevive a las pausas). `markGenerated` es el único
 * escritor del ancla de periodo.
 */
import type { Recurrence, RecurrenceInput } from '../../core/domain/recurrence';
import { RecurrenceInputSchema } from '../../core/domain/recurrence';
import type {
  RecurrenceEvent,
  RecurrencePatch,
  RecurrenceRepository,
} from '../../core/ports/RecurrenceRepository';
import type { SqlDbPort, SqlRow } from './SqlDbPort';
import { uuid } from './sqlErrors';

interface Row extends SqlRow {
  id: string;
  type: string;
  amount_cents: number;
  currency: string;
  account_id: string;
  category_id: string | null;
  payee: string | null;
  note: string | null;
  day_of_month: number;
  active: number;
  last_generated_period: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const SELECT_COLS = `id, type, amount_cents, currency, account_id, category_id, payee, note,
  day_of_month, active, last_generated_period, created_at, updated_at, deleted_at`;

function toDomain(row: Row): Recurrence {
  return {
    id: row.id,
    type: row.type === 'income' ? 'income' : 'expense',
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    accountId: row.account_id,
    categoryId: row.category_id,
    payee: row.payee,
    note: row.note,
    dayOfMonth: Number(row.day_of_month),
    active: Number(row.active) === 1,
    lastGeneratedPeriod: row.last_generated_period,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const PATCH_COLUMNS: Record<keyof RecurrencePatch, string> = {
  amountCents: 'amount_cents',
  categoryId: 'category_id',
  accountId: 'account_id',
  payee: 'payee',
  note: 'note',
  dayOfMonth: 'day_of_month',
  active: 'active',
};

export class SqlRecurrenceRepository implements RecurrenceRepository {
  private readonly listeners = new Set<(e: RecurrenceEvent) => void>();

  constructor(private readonly db: SqlDbPort) {}

  private notify(id: string): void {
    for (const cb of this.listeners) cb({ scope: 'recurrence', type: 'recurrence:changed', id });
  }

  private async requireGet(id: string): Promise<Recurrence> {
    const rows = await this.db.select<Row>(
      `SELECT ${SELECT_COLS} FROM recurrences WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error('NOT_FOUND');
    return toDomain(row);
  }

  async list(): Promise<Recurrence[]> {
    const rows = await this.db.select<Row>(
      `SELECT ${SELECT_COLS} FROM recurrences WHERE deleted_at IS NULL
       ORDER BY day_of_month ASC, created_at ASC`,
    );
    return rows.map(toDomain);
  }

  async create(input: RecurrenceInput): Promise<Recurrence> {
    const parsed = RecurrenceInputSchema.parse(input);
    const id = uuid();
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO recurrences (id, type, amount_cents, currency, account_id, category_id,
        payee, note, day_of_month, active, last_generated_period, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,1,NULL,?,?)`,
      [
        id,
        parsed.type,
        parsed.amountCents,
        parsed.currency.toUpperCase(),
        parsed.accountId,
        parsed.categoryId ?? null,
        parsed.payee ?? null,
        parsed.note ?? null,
        parsed.dayOfMonth,
        now,
        now,
      ],
    );
    this.notify(id);
    return this.requireGet(id);
  }

  async update(id: string, patch: RecurrencePatch): Promise<Recurrence> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(PATCH_COLUMNS) as [keyof RecurrencePatch, string][]) {
      const value = patch[key];
      if (value === undefined) continue;
      sets.push(`${column} = ?`);
      params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    if (sets.length > 0) {
      const now = new Date().toISOString();
      sets.push('updated_at = ?');
      params.push(now, id);
      await this.db.run(
        `UPDATE recurrences SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );
      this.notify(id);
    }
    return this.requireGet(id);
  }

  async remove(id: string): Promise<void> {
    const rows = await this.db.select<Row>(
      'SELECT id FROM recurrences WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    if (!rows[0]) return; // idempotente
    const now = new Date().toISOString();
    await this.db.run('UPDATE recurrences SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ]);
    this.notify(id);
  }

  async markGenerated(id: string, period: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE recurrences SET last_generated_period = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [period, now, id],
    );
    this.notify(id);
  }

  subscribe(cb: (e: RecurrenceEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
