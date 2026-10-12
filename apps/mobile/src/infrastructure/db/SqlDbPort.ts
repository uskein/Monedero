/**
 * SqlDbPort — abstracción asíncrona de bajo nivel sobre la BD local.
 * Async es intencionado: SQLCipher (expo-sqlite) es async en prod, sql.js es
 * sync en test; el adaptador envuelve sync en promesas resueltas para que el
 * MISMO repositorio funcione en ambas plataformas sin ramificar la lógica.
 */
export interface SqlRow {
  [column: string]: unknown;
}

export interface SqlDbPort {
  /** Ejecuta DML (INSERT/UPDATE/DELETE) con params posicionales (?). */
  run(sql: string, params?: unknown[]): Promise<void>;
  /** Ejecuta SELECT y devuelve las filas. */
  select<T extends SqlRow = SqlRow>(sql: string, params?: unknown[]): Promise<T[]>;
}
