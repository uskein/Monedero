/**
 * SqlTransactionRepository — implementación móvil sobre SqlDbPort.
 * Semántica idéntica al repositorio de la PWA (CONTRATOS_API §1.1).
 * El driver (SQLCipher prod / sql.js test) se inyecta vía SqlDbPort; aquí solo
 * hay DML/SELECT con params posicionales (?) y subscribe por eventos.
 */
import type { Transaction, TxFilter, TxInput, TxPatch } from '../../core/domain/transaction';
import { TxInputSchema, TxPatchSchema, sanitizeSearch } from '../../core/domain/transaction';
import type { RepositoryEvent, TransactionRepository } from '../../core/ports/TransactionRepository';
import type { SqlDbPort, SqlRow } from './SqlDbPort';

interface Row extends SqlRow {
  id: string;
  type: string;
  amount_cents: number;
  currency: string;
  date: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  payee: string | null;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const SELECT_COLS = `id, type, amount_cents, currency, date, account_id, to_account_id,
  category_id, payee, note, status, created_at, updated_at, deleted_at`;

function toDomain(row: Row): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction['type'],
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    date: row.date,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    payee: row.payee,
    note: row.note,
    status: row.status as Transaction['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** uuid v4 sin dependencias (crypto.randomUUID con fallback). */
function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const c = g.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c0) => {
    const r = (Math.random() * 16) | 0;
    const v = c0 === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class SqlTransactionRepository implements TransactionRepository {
  private readonly listeners = new Set<(e: RepositoryEvent) => void>();

  constructor(private readonly db: SqlDbPort) {}

  private notify(type: RepositoryEvent['type'], id: string): void {
    for (const cb of this.listeners) cb({ scope: 'tx', type, id });
  }

  subscribe(listener: (e: RepositoryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async list(filter: TxFilter = {}): Promise<Transaction[]> {
    const where: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filter.month) {
      where.push('substr(date, 1, 7) = ?');
      params.push(filter.month);
    }
    if (filter.accountId) {
      where.push('(account_id = ? OR to_account_id = ?)');
      params.push(filter.accountId, filter.accountId);
    }
    if (filter.categoryId) {
      where.push('category_id = ?');
      params.push(filter.categoryId);
    }
    if (filter.type) {
      where.push('type = ?');
      params.push(filter.type);
    }
    if (filter.search) {
      where.push("(payee LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')");
      const term = `%${sanitizeSearch(filter.search)}%`;
      params.push(term, term);
    }

    let sql = `SELECT ${SELECT_COLS} FROM transactions WHERE ${where.join(' AND ')}
      ORDER BY date DESC, id DESC`;
    if (filter.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
      if (filter.offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    const rows = await this.db.select<Row>(sql, params);
    return rows.map(toDomain);
  }

  async getById(id: string): Promise<Transaction | null> {
    const rows = await this.db.select<Row>(`SELECT ${SELECT_COLS} FROM transactions WHERE id = ?`, [id]);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async create(input: TxInput): Promise<Transaction> {
    const parsed = TxInputSchema.parse(input); // Zod ANTES de persistir
    const now = new Date().toISOString();
    const id = uuid();
    await this.db.run(
      `INSERT INTO transactions (id, type, amount_cents, currency, date, account_id,
        to_account_id, category_id, payee, note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        parsed.type,
        parsed.amountCents,
        parsed.currency,
        parsed.date,
        parsed.accountId,
        parsed.toAccountId ?? null,
        parsed.categoryId ?? null,
        parsed.payee ?? null,
        parsed.note ?? null,
        parsed.status,
        now,
        now,
      ],
    );
    this.notify('tx:created', id);
    const created = await this.getById(id);
    if (!created) throw new Error('TRANSACTION_NOT_PERSISTED');
    return created;
  }

  async update(id: string, patch: TxPatch): Promise<Transaction> {
    const parsed = TxPatchSchema.parse(patch);
    const existing = await this.getById(id);
    if (!existing || existing.deletedAt) throw new Error('TRANSACTION_NOT_FOUND');

    const merged = TxInputSchema.parse({
      type: parsed.type ?? existing.type,
      amountCents: parsed.amountCents ?? existing.amountCents,
      currency: parsed.currency ?? existing.currency,
      date: parsed.date ?? existing.date,
      accountId: parsed.accountId ?? existing.accountId,
      toAccountId: parsed.toAccountId !== undefined ? parsed.toAccountId : existing.toAccountId,
      categoryId: parsed.categoryId !== undefined ? parsed.categoryId : existing.categoryId,
      payee: parsed.payee !== undefined ? parsed.payee : existing.payee,
      note: parsed.note !== undefined ? parsed.note : existing.note,
      status: parsed.status ?? existing.status,
    });

    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE transactions SET type = ?, amount_cents = ?, currency = ?, date = ?,
        account_id = ?, to_account_id = ?, category_id = ?, payee = ?, note = ?,
        status = ?, updated_at = ? WHERE id = ?`,
      [
        merged.type,
        merged.amountCents,
        merged.currency,
        merged.date,
        merged.accountId,
        merged.toAccountId ?? null,
        merged.categoryId ?? null,
        merged.payee ?? null,
        merged.note ?? null,
        merged.status,
        now,
        id,
      ],
    );
    this.notify('tx:updated', id);
    const updated = await this.getById(id);
    if (!updated) throw new Error('TRANSACTION_NOT_PERSISTED');
    return updated;
  }

  /** Tombstone: conserva la fila (se exporta para propagar el borrado, MODELO §5). */
  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    this.notify('tx:deleted', id);
  }

  async restore(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL',
      [now, id],
    );
    this.notify('tx:restored', id);
  }

  /** Balance de cuenta: initial + ingresos − gastos (transferencias solo mueven, MODELO §7). */
  async balanceOf(accountId: string, initialBalanceCents: number): Promise<number> {
    const rows = await this.db.select<{ delta: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income'  AND account_id = ?      THEN  amount_cents END), 0)
       - COALESCE(SUM(CASE WHEN type = 'expense' AND account_id = ?      THEN  amount_cents END), 0)
       - COALESCE(SUM(CASE WHEN type = 'transfer' AND account_id = ?      THEN  amount_cents END), 0)
       + COALESCE(SUM(CASE WHEN type = 'transfer' AND to_account_id = ?  THEN  amount_cents END), 0)
       AS delta
       FROM transactions WHERE deleted_at IS NULL AND (account_id = ? OR to_account_id = ?)`,
      [accountId, accountId, accountId, accountId, accountId, accountId],
    );
    return initialBalanceCents + Number(rows[0]?.delta ?? 0);
  }

  /** Informe mensual (HU-09): ingreso, gasto y balance del mes. */
  async monthReport(month: string): Promise<{ incomeCents: number; expenseCents: number; balanceCents: number }> {
    const rows = await this.db.select<{ income: number; expense: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount_cents END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents END), 0) AS expense
       FROM transactions WHERE deleted_at IS NULL AND substr(date, 1, 7) = ?`,
      [month],
    );
    const incomeCents = Number(rows[0]?.income ?? 0);
    const expenseCents = Number(rows[0]?.expense ?? 0);
    return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
  }
}
