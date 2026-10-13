/**
 * engineSqlJs — motor DevEngine para JEST: implementa el MISMO contrato que
 * sqliteEngine (expo-sqlite) pero sobre sql.js (build asm.js). Sustituye al
 * motor nativo vía moduleNameMapper ('./sqliteEngine' → este archivo): ningún
 * test carga módulos nativos y createDevRepository corre idéntico en jest.
 */
import initSqlJs from '../../src/infrastructure/db/sqlasm';
import { sqlJsDb } from '../../src/infrastructure/db/sqljsAdapter';
import type { DevDatabase, DevEngine } from '../../src/infrastructure/db/devEngine';

export function sqliteEngine(): DevEngine {
  return {
    async open(fromBytes: Uint8Array | null): Promise<DevDatabase> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SQL: any = await initSqlJs();
      const raw = fromBytes ? new SQL.Database(fromBytes) : new SQL.Database();
      const port = sqlJsDb(raw);
      return {
        run: port.run,
        select: port.select,
        execScript(sql: string) {
          raw.run(sql); // sql.js: run ejecuta el script DDL completo (hoy y siempre en jest)
          return Promise.resolve();
        },
        exportBytes() {
          return Promise.resolve(raw.export() as Uint8Array);
        },
        close() {
          try {
            raw.close();
          } catch {
            // ya cerrada
          }
          return Promise.resolve();
        },
      };
    },
  };
}
