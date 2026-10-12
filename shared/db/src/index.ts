/**
 * @monedero/db — esquema y migraciones SQLite compartidas por semántica.
 * SSOT: MODELO_DE_DATOS.md. Móvil importa SOLO este módulo (SQLCipher adapter
 * propio en infrastructure/); la PWA puede importar también '@monedero/db/sqljs'.
 */
export { MIGRATIONS, SQL_001_INIT, LATEST_VERSION, type Migration } from './migrations';
export {
  runMigrations,
  assertValidMigrations,
  type MigrationExecutor,
  type MigrationResult,
} from './runner';

/** Tablas del esquema v1 (8) — usado por gates y tests de integridad. */
export const SCHEMA_TABLES_V1 = [
  'accounts',
  'categories',
  'transactions',
  'tags',
  'transaction_tags',
  'budgets',
  'settings',
  'import_log',
] as const;
