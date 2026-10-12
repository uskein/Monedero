/**
 * Tests del TransactionRepository (sql.js en memoria) — integración real con el esquema.
 * Fuente: CONTRATOS_API.md §1.1 · MODELO_DE_DATOS.md §7 (vistas derivadas).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import { seedDefaults } from '../../src/data/db/seed';
import { SqlJsTransactionRepository } from '../../src/data/repo/tx.repo.sqljs';
import type { TxInput } from '../../src/data/domain/transactions';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SQL: any = await initSqlJs();

let db: Database;
let repo: SqlJsTransactionRepository;

const NOW = new Date().toISOString();

function makeInput(overrides: Partial<TxInput> = {}): TxInput {
  return {
    type: 'expense',
    amountCents: 18500,
    currency: 'COP',
    date: '2026-10-11',
    accountId: 'acc-efectivo',
    payee: 'Almuerzo',
    ...overrides,
  } as TxInput;
}

beforeAll(async () => {
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
  seedDefaults(db);
  // cuenta adicional para transferencias
  db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-ahorro','Ahorro','savings','COP',500000,'${NOW}','${NOW}')`,
  );
  repo = new SqlJsTransactionRepository(db);
});

afterAll(() => {
  db.close();
});

describe('SqlJsTransactionRepository — create', () => {
  it('crea un gasto y lo devuelve con id y timestamps', async () => {
    const tx = await repo.create(makeInput());
    expect(tx.id).toBeTruthy();
    expect(tx.type).toBe('expense');
    expect(tx.amountCents).toBe(18500);
    expect(tx.createdAt).toBeTruthy();
    expect(tx.deletedAt).toBeNull();
  });

  it('crea un ingreso', async () => {
    const tx = await repo.create(
      makeInput({ type: 'income', amountCents: 2500000, categoryId: 'cat-salario', payee: 'Nómina' }),
    );
    expect(tx.type).toBe('income');
    expect(tx.amountCents).toBe(2500000);
  });

  it('crea una transferencia válida', async () => {
    const tx = await repo.create(
      makeInput({ type: 'transfer', toAccountId: 'acc-ahorro', categoryId: null, amountCents: 100000 }),
    );
    expect(tx.type).toBe('transfer');
    expect(tx.toAccountId).toBe('acc-ahorro');
  });

  it('rechaza (Zod) un importe 0 antes de tocar la BD', async () => {
    await expect(repo.create(makeInput({ amountCents: 0 }))).rejects.toThrow();
  });
});

describe('SqlJsTransactionRepository — list / filtros', () => {
  it('lista ordenada por date DESC, id DESC', async () => {
    const items = await repo.list();
    expect(items.length).toBeGreaterThan(0);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1]!.date >= items[i]!.date).toBe(true);
    }
  });

  it('filtra por mes (YYYY-MM)', async () => {
    const items = await repo.list({ month: '2026-10' });
    expect(items.every((tx) => tx.date.startsWith('2026-10'))).toBe(true);
  });

  it('filtra por tipo', async () => {
    const items = await repo.list({ type: 'income' });
    expect(items.every((tx) => tx.type === 'income')).toBe(true);
  });

  it('filtra por payee (búsqueda, saneada)', async () => {
    const items = await repo.list({ search: 'Almuerzo' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((tx) => (tx.payee ?? '').includes('Almuerzo'))).toBe(true);
  });

  it('la búsqueda con % no rompe (LIKE escapado)', async () => {
    await expect(repo.list({ search: '%_' })).resolves.toBeInstanceOf(Array);
  });
});

describe('SqlJsTransactionRepository — softDelete / restore (tombstones)', () => {
  it('softDelete marca deleted_at y lo excluye de list()', async () => {
    const tx = await repo.create(makeInput({ payee: 'Borrarme' }));
    await repo.softDelete(tx.id);
    const items = await repo.list();
    expect(items.find((i) => i.id === tx.id)).toBeUndefined();
    const raw = await repo.getById(tx.id);
    expect(raw?.deletedAt).toBeTruthy(); // la fila se conserva (export la propaga)
  });

  it('restore devuelve el movimiento a la lista', async () => {
    const tx = await repo.create(makeInput({ payee: 'Restaurarme' }));
    await repo.softDelete(tx.id);
    await repo.restore(tx.id);
    const items = await repo.list();
    expect(items.find((i) => i.id === tx.id)).toBeTruthy();
  });
});

describe('SqlJsTransactionRepository — vistas derivadas (MODELO §7)', () => {
  // Cuenta y mes DEDICADOS para aislar estos tests de los datos de otros bloques.
  const NOW2 = new Date().toISOString();
  beforeAll(async () => {
    db.run(
      `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
       VALUES ('acc-vistas','Vistas','cash','COP',100000,'${NOW2}','${NOW2}')`,
    );
    // Mes 2026-11 (aislado del 2026-10 usado arriba)
    await repo.create(
      makeInput({ type: 'income', amountCents: 300000, date: '2026-11-05', accountId: 'acc-vistas', categoryId: 'cat-salario', payee: 'Nómina nov' }),
    );
    await repo.create(
      makeInput({ type: 'expense', amountCents: 45000, date: '2026-11-10', accountId: 'acc-vistas', categoryId: 'cat-comida', payee: 'Comida nov' }),
    );
    await repo.create(
      makeInput({ type: 'transfer', amountCents: 20000, date: '2026-11-12', accountId: 'acc-vistas', toAccountId: 'acc-ahorro', categoryId: null, payee: 'Ahorro nov' }),
    );
  });

  it('balanceOf: initial + ingresos − gastos (transferencias mueven saldo)', async () => {
    const balance = await repo.balanceOf('acc-vistas', 100000);
    // 100000 + 300000 (ingreso) − 45000 (gasto) − 20000 (transfer saliente) = 335000
    expect(balance).toBe(100000 + 300000 - 45000 - 20000);
  });

  it('balanceOf en cuenta destino: + transferencia entrante', async () => {
    const balance = await repo.balanceOf('acc-ahorro', 500000);
    // transferencias entrantes: 100000 (oct) + 20000 (nov)
    expect(balance).toBe(500000 + 100000 + 20000);
  });

  it('monthReport: ingreso, gasto y balance del mes aislado', async () => {
    const report = await repo.monthReport('2026-11');
    expect(report.incomeCents).toBe(300000);
    expect(report.expenseCents).toBe(45000);
    expect(report.balanceCents).toBe(300000 - 45000);
  });
});

describe('SqlJsTransactionRepository — dashboardSummary (BP-03 · HU-08·09)', () => {
  /** Saldo inicial de TODAS las cuentas, leído de la BD (sin números mágicos). */
  function initialBalancesTotal(): number {
    const res = db.exec(
      'SELECT COALESCE(SUM(initial_balance_cents),0) FROM accounts WHERE deleted_at IS NULL',
    );
    // sql.js exec → [{ columns, values }]: el escalar está en values[0][0].
    return Number(res[0]?.values?.[0]?.[0] ?? 0);
  }

  it('totalBalanceCents = Σ iniciales + Σ ingresos − Σ gastos (transferencias cancelan)', async () => {
    const all = await repo.list(); // excluye tombstones, igual que la consulta
    const income = all.filter((t) => t.type === 'income').reduce((a, t) => a + t.amountCents, 0);
    const expense = all.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amountCents, 0);
    const summary = await repo.dashboardSummary('2026-11');
    expect(summary.totalBalanceCents).toBe(initialBalancesTotal() + income - expense);
  });

  it('coincide con la suma de balanceOf de cada cuenta', async () => {
    const summary = await repo.dashboardSummary('2026-11');
    const total =
      (await repo.balanceOf('acc-efectivo', 0)) +
      (await repo.balanceOf('acc-ahorro', 500000)) +
      (await repo.balanceOf('acc-vistas', 100000));
    expect(summary.totalBalanceCents).toBe(total);
  });

  it('ingreso/gasto del mes coinciden con monthReport (2026-11 aislado)', async () => {
    const summary = await repo.dashboardSummary('2026-11');
    const report = await repo.monthReport('2026-11');
    expect(summary.incomeCents).toBe(report.incomeCents);
    expect(summary.expenseCents).toBe(report.expenseCents);
    expect(summary.monthBalanceCents).toBe(report.balanceCents);
    expect(summary.incomeCents).toBe(300000);
    expect(summary.expenseCents).toBe(45000);
  });

  it('mes sin movimientos → periodo en 0; el saldo total es global (independiente del mes)', async () => {
    const empty = await repo.dashboardSummary('2027-01');
    expect(empty.incomeCents).toBe(0);
    expect(empty.expenseCents).toBe(0);
    expect(empty.monthBalanceCents).toBe(0);
    const other = await repo.dashboardSummary('2026-11');
    expect(empty.totalBalanceCents).toBe(other.totalBalanceCents);
  });
});

describe('SqlJsTransactionRepository — subscribe', () => {
  it('emite evento tx:created tras create', async () => {
    const events: string[] = [];
    const unsub = repo.subscribe(({ scope }) => events.push(scope));
    await repo.create(makeInput({ payee: 'Subscribirme' }));
    expect(events).toContain('tx');
    unsub();
  });
});
