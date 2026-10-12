/**
 * Tests del SqlBudgetRepository móvil (HU-11·12) — integración real con el
 * esquema (sql.js + migraciones). Cubre: upsert idempotente sobre
 * UNIQUE(category,period) · revivir tombstone · validación ≤0/periodo ·
 * usage con gastos solo del periodo y la categoría · eventos.
 */
import type { Database } from 'sql.js';
import initSqlJs from 'sql.js';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import { SqlBudgetRepository } from '../../src/infrastructure/db/budget.repo.sql';
import { sqlJsDb } from '../../src/infrastructure/db/sqljsAdapter';

const NOW = new Date().toISOString();

let db: Database;
let budgets: SqlBudgetRepository;

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
  db.run(
    `INSERT INTO accounts (id,name,type,currency,created_at,updated_at)
     VALUES ('acc-efectivo','Efectivo','cash','COP','${NOW}','${NOW}')`,
  );
  budgets = new SqlBudgetRepository(sqlJsDb(db));
});

afterEach(() => {
  db.run('DELETE FROM transactions');
  db.run('DELETE FROM budgets');
  db.run('DELETE FROM categories');
});

afterAll(() => {
  db.close();
});

function seedCategory(id: string, name = 'Comida'): void {
  db.run(
    `INSERT INTO categories (id,name,type,created_at,updated_at)
     VALUES ('${id}','${name}','expense','${NOW}','${NOW}')`,
  );
}

function insertExpense(id: string, categoryId: string, cents: number, date: string): void {
  db.run(
    `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,category_id,created_at,updated_at)
     VALUES ('${id}','expense',${cents},'COP','${date}','acc-efectivo','${categoryId}','${NOW}','${NOW}')`,
  );
}

describe('SqlBudgetRepository (HU-11)', () => {
  it('upsert crea el tope y get lo devuelve', async () => {
    seedCategory('cat-comida');
    const budget = await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    expect(budget.amountCents).toBe(100000);
    expect(budget.period).toBe('2026-10');
    const fetched = await budgets.get('cat-comida', '2026-10');
    expect(fetched?.id).toBe(budget.id);
  });

  it('upsert es idempotente: mismo (category, period) actualiza el importe sin duplicar', async () => {
    seedCategory('cat-comida');
    const first = await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    const second = await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 150000 });
    expect(second.id).toBe(first.id);
    expect(second.amountCents).toBe(150000);
    const rows = db.exec("SELECT COUNT(*) FROM budgets WHERE category_id = 'cat-comida'");
    expect(Number(rows[0]?.values[0]?.[0])).toBe(1);
  });

  it('upsert revive un presupuesto tombstoneado (mismo par, sin duplicar)', async () => {
    seedCategory('cat-comida');
    const first = await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    db.run(`UPDATE budgets SET deleted_at = '${NOW}' WHERE id = '${first.id}'`);
    expect(await budgets.get('cat-comida', '2026-10')).toBeNull();
    const revived = await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 80000 });
    expect(revived.id).toBe(first.id);
    expect(revived.deletedAt).toBeNull();
    expect(revived.amountCents).toBe(80000);
  });

  it('importe ≤ 0 o no entero → VALIDATION_FAILED (Zod) sin persistir', async () => {
    seedCategory('cat-comida');
    await expect(
      budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 0 }),
    ).rejects.toThrow();
    await expect(
      budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: -500 }),
    ).rejects.toThrow();
    await expect(
      budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 10.5 }),
    ).rejects.toThrow();
    expect((await budgets.listByPeriod('2026-10')).length).toBe(0);
  });

  it('periodo inválido (no YYYY-MM o mes 13) → rechaza', async () => {
    seedCategory('cat-comida');
    await expect(
      budgets.upsert({ categoryId: 'cat-comida', period: '2026-13', amountCents: 1000 }),
    ).rejects.toThrow();
    await expect(
      budgets.upsert({ categoryId: 'cat-comida', period: 'octubre', amountCents: 1000 }),
    ).rejects.toThrow();
  });

  it('listByPeriod devuelve solo los topes del periodo activo', async () => {
    seedCategory('cat-comida');
    seedCategory('cat-ocio', 'Ocio');
    await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    await budgets.upsert({ categoryId: 'cat-ocio', period: '2026-11', amountCents: 50000 });
    const oct = await budgets.listByPeriod('2026-10');
    expect(oct.map((b) => b.categoryId)).toEqual(['cat-comida']);
  });
});

describe('SqlBudgetRepository.usage (HU-12)', () => {
  it('sin gastos → spent 0 y ratio 0', async () => {
    seedCategory('cat-comida');
    await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    const usage = await budgets.usage('cat-comida', '2026-10');
    expect(usage).toEqual({ spentCents: 0, budgetCents: 100000, ratio: 0 });
  });

  it('suma solo gastos del periodo y de ESA categoría (excluye otros meses/categorías/ingresos)', async () => {
    seedCategory('cat-comida');
    seedCategory('cat-ocio', 'Ocio');
    await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    insertExpense('e1', 'cat-comida', 80000, '2026-10-05');
    insertExpense('e2', 'cat-comida', 30000, '2026-10-20');
    insertExpense('e3', 'cat-comida', 50000, '2026-11-02'); // otro mes
    insertExpense('e4', 'cat-ocio', 25000, '2026-10-10'); // otra categoría
    db.run(
      `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,category_id,created_at,updated_at)
       VALUES ('i1','income',99000,'COP','2026-10-06','acc-efectivo','cat-comida','${NOW}','${NOW}')`,
    );
    const usage = await budgets.usage('cat-comida', '2026-10');
    expect(usage.spentCents).toBe(110000);
    expect(usage.budgetCents).toBe(100000);
    expect(usage.ratio).toBeCloseTo(1.1);
  });

  it('gastos tombstoneados no cuentan', async () => {
    seedCategory('cat-comida');
    await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    insertExpense('e1', 'cat-comida', 40000, '2026-10-05');
    insertExpense('e2', 'cat-comida', 40000, '2026-10-06');
    db.run(`UPDATE transactions SET deleted_at = '${NOW}' WHERE id = 'e2'`);
    expect((await budgets.usage('cat-comida', '2026-10')).spentCents).toBe(40000);
  });

  it('sin presupuesto → budgetCents 0 y ratio 0 (sin división por cero)', async () => {
    seedCategory('cat-comida');
    insertExpense('e1', 'cat-comida', 40000, '2026-10-05');
    const usage = await budgets.usage('cat-comida', '2026-10');
    expect(usage).toEqual({ spentCents: 40000, budgetCents: 0, ratio: 0 });
  });
});

describe('SqlBudgetRepository eventos', () => {
  it('emite budget:upserted en cada upsert', async () => {
    seedCategory('cat-comida');
    const events: string[] = [];
    const off = budgets.subscribe((e) => events.push(e.type));
    const created = await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 100000 });
    await budgets.upsert({ categoryId: 'cat-comida', period: '2026-10', amountCents: 120000 });
    off();
    expect(events).toEqual(['budget:upserted', 'budget:upserted']);
    expect(created.amountCents).toBe(100000);
  });
});
