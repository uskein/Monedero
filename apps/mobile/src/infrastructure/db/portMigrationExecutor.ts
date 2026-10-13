/**
 * portMigrationExecutor — executor de migraciones (MODELO_DE_DATOS.md §6)
 * genérico sobre el contrato DevDatabase. Mismas semánticas que el executor
 * sql.js de '@monedero/db/sqljs' (BEGIN IMMEDIATE → COMMIT/ROLLBACK,
 * executeScript multi-sentencia, PRAGMA user_version), pero agnóstico al
 * motor: corre igual con expo-sqlite (runtime) y sql.js (jest).
 */
import type { MigrationExecutor } from '@monedero/db';
import type { DevDatabase } from './devEngine';

export function portMigrationExecutor(db: DevDatabase): MigrationExecutor {
  return {
    async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
      await db.run('BEGIN IMMEDIATE');
      try {
        const value = await fn();
        await db.run('COMMIT');
        return value;
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
    },
    executeScript(sql: string) {
      return db.execScript(sql);
    },
    async readVersion() {
      const rows = await db.select<{ user_version?: unknown }>('PRAGMA user_version');
      return Number(rows[0]?.user_version ?? 0);
    },
    writeVersion(version: number) {
      return db.run(`PRAGMA user_version = ${version}`);
    },
  };
}
