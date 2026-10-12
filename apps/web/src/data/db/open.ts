/**
 * Apertura de la BD local (PWA) — sql.js en memoria + migraciones @monedero/db.
 * ADR-003: la BD vive en RAM; la persistencia cifrada (blob AES-GCM → IndexedDB)
 * se enchufa aquí en S4 al sincronizar el store.
 * En tests (vitest MODE=test) se inicializa sin locateFile: sql.js resuelve el
 * wasm desde node_modules vía su rama node (process existe en vitest).
 */
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import { seedDefaults } from './seed';

let singleton: Database | null = null;
/** Promesa en curso: sin ella, dos efectos concurrentes (AppShell monta
 *  Inicio y Movimientos a la vez) crearían DOS BDs distintas y los datos no
 *  se verían entre pantallas. */
let pending: Promise<Database> | null = null;

export function openDb(): Promise<Database> {
  if (singleton) return Promise.resolve(singleton);
  pending ??= (async () => {
    const isTest = import.meta.env?.MODE === 'test';
    const SQL = await (isTest
      ? initSqlJs()
      : initSqlJs({
          locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file),
        }));
    const db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
    seedDefaults(db);
    singleton = db;
    return db;
  })().catch((err: unknown) => {
    pending = null; // permite reintentar tras un fallo de init
    throw err;
  });
  return pending;
}

/** Solo tests: limpia el singleton para aislar BDs. */
export function resetDbSingleton(): void {
  singleton?.close();
  singleton = null;
  pending = null;
}
