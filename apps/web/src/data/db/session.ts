/**
 * Sesión de datos de la PWA — UNA instancia de BD compartida por BP-03
 * (dashboard), BP-04 (lista), BP-06 (presupuestos) y BP-08 (categorías).
 * Los listeners de repo.subscribe viven en la INSTANCIA: con dos repos sobre
 * la misma BD los eventos 'tx' no cruzarían y la sincronía tx:created →
 * balance (tarea 4.3) no funcionaría. Las promesas se memoizan: el AppShell
 * monta todas las pantallas en el mismo ciclo y dos llamadas concurrentes
 * producirían dos repos distintos.
 */
import type { Database } from 'sql.js';
import { openDb, resetDbSingleton } from './open';
import { SqlJsTransactionRepository } from '../repo/tx.repo.sqljs';
import { SqlJsCategoryRepository } from '../repo/categories.repo.sqljs';

let dbPending: Promise<Database> | null = null;
let repo: SqlJsTransactionRepository | null = null;
let repoPending: Promise<SqlJsTransactionRepository> | null = null;
let categoriesRepo: SqlJsCategoryRepository | null = null;
let categoriesPending: Promise<SqlJsCategoryRepository> | null = null;

/** BD singleton de la sesión (la primera llamada la abre). */
function getDb(): Promise<Database> {
  dbPending ??= openDb().catch((err: unknown) => {
    dbPending = null; // permite reintentar tras un fallo de init
    throw err;
  });
  return dbPending;
}

/** Devuelve el repo de movimientos de la sesión (abre la BD la primera vez). */
export function getTxRepo(): Promise<SqlJsTransactionRepository> {
  if (repo) return Promise.resolve(repo);
  repoPending ??= getDb()
    .then((d) => {
      repo = new SqlJsTransactionRepository(d);
      return repo;
    })
    .catch((err: unknown) => {
      repoPending = null;
      throw err;
    });
  return repoPending;
}

/** Devuelve el repo de categorías de la MISMA sesión (misma BD instance). */
export function getCategoriesRepo(): Promise<SqlJsCategoryRepository> {
  if (categoriesRepo) return Promise.resolve(categoriesRepo);
  categoriesPending ??= getDb()
    .then((d) => {
      categoriesRepo = new SqlJsCategoryRepository(d);
      return categoriesRepo;
    })
    .catch((err: unknown) => {
      categoriesPending = null;
      throw err;
    });
  return categoriesPending;
}

/** Solo tests: limpia repos + BD singleton para el siguiente caso. */
export function resetSession(): void {
  dbPending = null;
  repo = null;
  repoPending = null;
  categoriesRepo = null;
  categoriesPending = null;
  resetDbSingleton();
}
