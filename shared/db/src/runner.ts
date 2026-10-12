/**
 * Runner de migraciones — MODELO_DE_DATOS.md §6.
 * Semántica idéntica en móvil (SQLCipher) y PWA (sql.js): el executor traduce
 * el dialecto; este runner es puro y se prueba con sql.js en memoria.
 *
 * 1. Leer `user_version` → aplicar scripts `> version` en orden → fijar versión.
 * 2. Cada script es transaccional (BEGIN IMMEDIATE … COMMIT); fallo → rollback + abort.
 * 3. Solo forward: nunca se degrada la versión.
 */

/** Puerto mínimo que cualquier SQLite portador implementa. */
export interface MigrationExecutor {
  /** Ejecuta `fn` dentro de una transacción (BEGIN IMMEDIATE…COMMIT). Fallo → ROLLBACK. */
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;
  /** Ejecuta un script SQL multi-sentencia (DDL). Lanza en SQL inválido. */
  executeScript(sql: string): Promise<void> | void;
  /** PRAGMA user_version. */
  readVersion(): Promise<number> | number;
  /** PRAGMA user_version = N. */
  writeVersion(version: number): Promise<void> | void;
}

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export interface MigrationResult {
  from: number;
  to: number;
  applied: string[];
}

/**
 * Aplica todas las migraciones pendientes. Idempotente: si no hay pendientes,
 * no ejecuta nada. Lanza si una migración falla (la BD queda sin cambios por
 * el rollback transaccional — nunca una BD a medias).
 */
export async function runMigrations(
  exec: MigrationExecutor,
  migrations: readonly Migration[],
): Promise<MigrationResult> {
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const from = await exec.readVersion();
  const applied: string[] = [];

  for (const migration of ordered) {
    if (migration.version <= from) continue;
    // Doble chequeo de versión dentro de la transacción (dos hilos no dupliquen).
    await exec.transaction(async () => {
      const current = await exec.readVersion();
      if (current >= migration.version) return;
      await exec.executeScript(migration.sql);
      await exec.writeVersion(migration.version);
    });
    applied.push(migration.name);
  }

  const to = await exec.readVersion();
  return { from, to, applied };
}

/** Valida la lista de migraciones: versiones únicas e incrementales desde 1. */
export function assertValidMigrations(migrations: readonly Migration[]): void {
  const seen = new Set<number>();
  migrations.forEach((m, i) => {
    if (seen.has(m.version)) throw new Error(`MIGRATION_DUPLICATE_VERSION:${m.version}`);
    if (m.version !== i + 1) throw new Error(`MIGRATION_SEQUENCE_BROKEN:${m.version}@${i}`);
    seen.add(m.version);
  });
}
