/**
 * createDevRepository — fábrica de TransactionRepository sobre sql.js en memoria.
 *
 * Propósito: probar y demostrar el vertical slice de movimientos en móvil ANTES de
 * instalar el driver de producción (SQLCipher/expo-sqlite, que requiere build nativa).
 * Al añadir el módulo nativo, se sustituye por un adaptador SqlDbPort sobre SQLCipher
 * y esta fábrica desaparece; la UI y el store no cambian (hexagonal).
 */
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import { sqlJsDb } from './sqljsAdapter';
import { SqlTransactionRepository } from './tx.repo.sql';

const NOW = '2026-10-11T00:00:00.000Z';

const EXPENSE_CATEGORIES = ['cat-comida', 'cat-transporte', 'cat-casa', 'cat-salud', 'cat-ocio', 'cat-otros'];
const INCOME_CATEGORIES = ['cat-salario', 'cat-ingresos-otros'];
const CATEGORY_NAMES: Record<string, string> = {
  'cat-comida': 'Comida',
  'cat-transporte': 'Transporte',
  'cat-casa': 'Casa',
  'cat-salud': 'Salud',
  'cat-ocio': 'Ocio',
  'cat-otros': 'Otros',
  'cat-salario': 'Salario',
  'cat-ingresos-otros': 'Otros ingresos',
};

function seed(db: Database): void {
  db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-efectivo','Efectivo','cash','COP',0,'${NOW}','${NOW}')`,
  );
  db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-ahorro','Ahorro','savings','COP',0,'${NOW}','${NOW}')`,
  );
  EXPENSE_CATEGORIES.forEach((id, i) => {
    db.run(
      `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
       VALUES ('${id}','${CATEGORY_NAMES[id]}','expense',${i},'${NOW}','${NOW}')`,
    );
  });
  INCOME_CATEGORIES.forEach((id, i) => {
    db.run(
      `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
       VALUES ('${id}','${CATEGORY_NAMES[id]}','income',${i},'${NOW}','${NOW}')`,
    );
  });
}

export interface DevRepository {
  repo: SqlTransactionRepository;
  db: Database;
  categoryNames: Record<string, string>;
}

/** Crea una repo en memoria con esquema migrado + seed (solo dev/test). */
export async function createDevRepository(): Promise<DevRepository> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
  seed(db);
  return { repo: new SqlTransactionRepository(sqlJsDb(db)), db, categoryNames: CATEGORY_NAMES };
}

export { CATEGORY_NAMES };
