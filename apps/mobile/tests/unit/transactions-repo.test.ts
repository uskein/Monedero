/**
 * Tests del SqlTransactionRepository móvil — integración real con el esquema.
 * Usa sql.js en memoria (@monedero/db) envuelto en el SqlDbPort (adaptador).
 * Semántica SQL idéntica a la PWA; aquí se prueba el driver async + adapter.
 */
import type { Database } from 'sql.js';
import initSqlJs from 'sql.js';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import { SqlTransactionRepository } from '../../src/infrastructure/db/tx.repo.sql';
import { sqlJsDb } from '../../src/infrastructure/db/sqljsAdapter';
import type { TxInput } from '../../src/core/domain/transaction';

const NOW = new Date().toISOString();

let db: Database;
let repo: SqlTransactionRepository;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
  db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-efectivo','Efectivo','cash','COP',0,'${NOW}','${NOW}')`,
  );
  db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-ahorro','Ahorro','savings','COP',500000,'${NOW}','${NOW}')`,
  );
  // categorías referenciadas por los tests (FK a categories)
  db.run(
    `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
     VALUES ('cat-comida','Comida','expense',0,'${NOW}','${NOW}')`,
  );
  db.run(
    `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
     VALUES ('cat-salario','Salario','income',0,'${NOW}','${NOW}')`,
  );
  repo = new SqlTransactionRepository(sqlJsDb(db));
});

afterAll(() => {
  db.close();
});

describe('SqlTransactionRepository — create', () => {
  it('crea un gasto con id y timestamps', async () => {
    const tx = await repo.create(makeInput());
    expect(tx.id).toBeTruthy();
    expect(tx.type).toBe('expense');
    expect(tx.amountCents).toBe(18500);
    expect(tx.deletedAt).toBeNull();
  });

  it('crea ingreso y transferencia válidos', async () => {
    const income = await repo.create(
      makeInput({ type: 'income', amountCents: 2500000, categoryId: 'cat-salario', payee: 'Nómina' }),
    );
    expect(income.type).toBe('income');
    const transfer = await repo.create(
      makeInput({ type: 'transfer', toAccountId: 'acc-ahorro', categoryId: null, amountCents: 100000 }),
    );
    expect(transfer.toAccountId).toBe('acc-ahorro');
  });

  it('rechaza importe 0 antes de tocar la BD (Zod)', async () => {
    await expect(repo.create(makeInput({ amountCents: 0 }))).rejects.toThrow();
  });
});

describe('SqlTransactionRepository — list / filtros', () => {
  it('ordena por date DESC, id DESC', async () => {
    const items = await repo.list();
    expect(items.length).toBeGreaterThan(0);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1]!.date >= items[i]!.date).toBe(true);
    }
  });

  it('filtra por mes y por tipo', async () => {
    const oct = await repo.list({ month: '2026-10' });
    expect(oct.every((t) => t.date.startsWith('2026-10'))).toBe(true);
    const incomes = await repo.list({ type: 'income' });
    expect(incomes.every((t) => t.type === 'income')).toBe(true);
  });

  it('búsqueda saneada no rompe con comodines', async () => {
    await expect(repo.list({ search: '%_' })).resolves.toBeInstanceOf(Array);
  });
});

describe('SqlTransactionRepository — softDelete / restore (tombstones)', () => {
  it('softDelete marca deleted_at y excluye de list; la fila se conserva', async () => {
    const tx = await repo.create(makeInput({ payee: 'Borrarme' }));
    await repo.softDelete(tx.id);
    const items = await repo.list();
    expect(items.find((i) => i.id === tx.id)).toBeUndefined();
    const raw = await repo.getById(tx.id);
    expect(raw?.deletedAt).toBeTruthy();
  });

  it('restore devuelve el movimiento', async () => {
    const tx = await repo.create(makeInput({ payee: 'Restaurarme' }));
    await repo.softDelete(tx.id);
    await repo.restore(tx.id);
    const items = await repo.list();
    expect(items.find((i) => i.id === tx.id)).toBeTruthy();
  });
});

describe('SqlTransactionRepository — vistas derivadas (MODELO §7)', () => {
  // Datos DEDICADOS en mes 2026-11 para aislar el informe de los tests anteriores.
  beforeAll(async () => {
    await repo.create(
      makeInput({ type: 'income', amountCents: 300000, date: '2026-11-05', accountId: 'acc-efectivo', categoryId: 'cat-salario', payee: 'Nómina nov' }),
    );
    await repo.create(
      makeInput({ type: 'expense', amountCents: 45000, date: '2026-11-10', accountId: 'acc-efectivo', categoryId: 'cat-comida', payee: 'Comida nov' }),
    );
  });

  it('balanceOf: initial + ingresos − gastos (transfer mueven saldo)', async () => {
    const balance = await repo.balanceOf('acc-ahorro', 500000);
    // transfer entrante de 100000 creada en el bloque create
    expect(balance).toBe(500000 + 100000);
  });

  it('monthReport: ingreso, gasto y balance del mes aislado', async () => {
    const report = await repo.monthReport('2026-11');
    expect(report.incomeCents).toBe(300000);
    expect(report.expenseCents).toBe(45000);
    expect(report.balanceCents).toBe(300000 - 45000);
  });
});

describe('SqlTransactionRepository — subscribe', () => {
  it('emite tx:created tras create', async () => {
    const events: string[] = [];
    const unsub = repo.subscribe((e) => events.push(e.type));
    await repo.create(makeInput({ payee: 'Subscribirme' }));
    expect(events).toContain('tx:created');
    unsub();
  });
});
