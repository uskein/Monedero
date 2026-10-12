/**
 * Adaptador sql.js del runner de migraciones (PWA + tests de ambas apps).
 * sql.js es síncrono; el runner acepta sync/async indistintamente.
 */
import type { Database } from 'sql.js';
import type { MigrationExecutor } from './runner';

export function sqlJsMigrationExecutor(db: Database): MigrationExecutor {
  return {
    transaction<T>(fn: () => Promise<T> | T): Promise<T> {
      db.run('BEGIN IMMEDIATE');
      try {
        const result = fn();
        if (result instanceof Promise) {
          return result.then(
            (value) => {
              db.run('COMMIT');
              return value;
            },
            (err) => {
              db.run('ROLLBACK');
              throw err;
            },
          );
        }
        db.run('COMMIT');
        return Promise.resolve(result);
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
    },
    executeScript(sql: string) {
      db.run(sql);
    },
    readVersion() {
      const result = db.exec('PRAGMA user_version');
      return Number(result[0]?.values[0]?.[0] ?? 0);
    },
    writeVersion(version: number) {
      db.run(`PRAGMA user_version = ${version}`);
    },
  };
}

/** Abre una BD sql.js en memoria con todas las migraciones aplicadas (tests). */
export async function createInMemoryDb(
  SQL: new (data?: ArrayLike<number>) => Database,
  migrations: readonly { version: number; name: string; sql: string }[],
  runMigrationsFn: (
    exec: MigrationExecutor,
    migrations: readonly { version: number; name: string; sql: string }[],
  ) => Promise<unknown>,
): Promise<Database> {
  const db = new SQL();
  db.run('PRAGMA foreign_keys = ON');
  await runMigrationsFn(sqlJsMigrationExecutor(db), migrations);
  return db;
}
