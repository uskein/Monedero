/**
 * sqliteEngine — motor de la sesión sobre expo-sqlite (SQLite NATIVO, Expo Go
 * compatible). Sustituye al build asm.js de sql.js (causa de la incompatibilidad
 * hermesc ↔ límite de anidamiento en builds release, D1):
 *  - la BD vive EN MEMORIA (`:memory:` o deserializeDatabaseAsync) — en disco
 *    solo existe el snapshot CIFRADO de la bóveda: la promesa ADR-003 (cero
 *    plaintext en reposo) se conserva íntegra;
 *  - `exportBytes` = serializeAsync (sqlite3_serialize), espejo exacto del
 *    antiguo db.export() de sql.js;
 *  - la restauración hidrata desde bytes, igual que new SQL.Database(bytes).
 * El import de expo-sqlite es DINÁMICO: jest nunca carga el módulo nativo
 * (moduleNameMapper sustituye este motor por el sql.js de tests).
 */
import type { SQLiteBindParams } from 'expo-sqlite';
import type { DevDatabase, DevEngine } from './devEngine';
import type { SqlRow } from './SqlDbPort';

export function sqliteEngine(): DevEngine {
  return {
    async open(fromBytes: Uint8Array | null): Promise<DevDatabase> {
      const SQLite = await import('expo-sqlite');
      const db = fromBytes
        ? await SQLite.deserializeDatabaseAsync(fromBytes)
        : await SQLite.openDatabaseAsync(':memory:');
      const bind = (params: unknown[]): SQLiteBindParams => params as unknown as SQLiteBindParams;
      return {
        async run(sql: string, params: unknown[] = []) {
          await db.runAsync(sql, bind(params));
        },
        select<T extends SqlRow>(sql: string, params: unknown[] = []) {
          return db.getAllAsync<T>(sql, bind(params));
        },
        execScript(sql: string) {
          return db.execAsync(sql);
        },
        exportBytes() {
          return db.serializeAsync();
        },
        close() {
          return db.closeAsync();
        },
      };
    },
  };
}
