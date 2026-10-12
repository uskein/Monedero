/**
 * Sesión de datos de la PWA — UNA instancia de SqlJsTransactionRepository
 * compartida por BP-03 (dashboard) y BP-04 (lista). Los listeners de
 * repo.subscribe viven en la INSTANCIA: con dos repos sobre la misma BD los
 * eventos 'tx' no cruzarían y la sincronía tx:created → balance (tarea 4.3)
 * no funcionaría. La promesa se memoiza igual que openDb: el AppShell monta
 * ambas pantallas en el mismo ciclo y dos llamadas concurrentes producirían
 * dos repos distintos.
 */
import { openDb, resetDbSingleton } from './open';
import { SqlJsTransactionRepository } from '../repo/tx.repo.sqljs';

let repo: SqlJsTransactionRepository | null = null;
let pending: Promise<SqlJsTransactionRepository> | null = null;

/** Devuelve el repo de la sesión (abre la BD la primera vez). */
export function getTxRepo(): Promise<SqlJsTransactionRepository> {
  if (repo) return Promise.resolve(repo);
  pending ??= openDb()
    .then((db) => {
      repo = new SqlJsTransactionRepository(db);
      return repo;
    })
    .catch((err: unknown) => {
      pending = null; // permite reintentar tras un fallo de init
      throw err;
    });
  return pending;
}

/** Solo tests: limpia repo + BD singleton para el siguiente caso. */
export function resetSession(): void {
  repo = null;
  pending = null;
  resetDbSingleton();
}
