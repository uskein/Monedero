/**
 * sqlJsDb — adaptador SqlDbPort sobre sql.js (solo tests / entorno node).
 * En producción móvil el driver es SQLCipher (expo-sqlite) vía otro adaptador
 * del MISMO puerto; la lógica del repositorio no cambia.
 */
import type { Database } from 'sql.js';
import type { SqlValue } from 'sql.js';
import type { SqlDbPort, SqlRow } from './SqlDbPort';

export function sqlJsDb(db: Database): SqlDbPort {
  return {
    run(sql: string, params: unknown[] = []) {
      db.run(sql, params as SqlValue[]);
      return Promise.resolve();
    },
    select<T extends SqlRow>(sql: string, params: unknown[] = []) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params as SqlValue[]);
        const out: T[] = [];
        while (stmt.step()) out.push(stmt.getAsObject() as unknown as T);
        return Promise.resolve(out);
      } finally {
        stmt.free();
      }
    },
  };
}
