/**
 * createDevRepository — fábrica de la sesión (repos + motor de BD) con
 * PERSISTENCIA CIFRADA INTERINA (ADR-003):
 *  - al arrancar se restaura el último snapshot sellado con la clave de bóveda
 *    (AES-256-GCM) desde el archivo de la app;
 *  - tras cada evento de escritura (movimientos/categorías/presupuestos) y al
 *    pasar a segundo plano, se serializa la BD y se guarda el blob cifrado;
 *  - snapshot ilegible o clave distinta → se descarta y se empieza limpio
 *    (misma semántica que la bóveda: mejor crear de nuevo que bloquear).
 * La clave maestra NUNCA sale de KeyVault (encryptBytes/decryptBytes).
 * MOTOR (D1 ejecutada): runtime = sqliteEngine (expo-sqlite NATIVO, BD en
 * memoria → en disco solo el snapshot cifrado); jest = motor sql.js equivalente
 * (tests/helpers/engineSqlJs.ts vía moduleNameMapper). La fábrica es agnóstica
 * al motor (puerto DevEngine); la UI y los stores no cambian (hexagonal).
 */
import { AppState } from 'react-native';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { portMigrationExecutor } from './portMigrationExecutor';
import { sqliteEngine } from './sqliteEngine';
import type { DevDatabase, DevEngine } from './devEngine';
import type { SqlDbPort } from './SqlDbPort';
import { SqlTransactionRepository } from './tx.repo.sql';
import { SqlCategoryRepository } from './category.repo.sql';
import { SqlBudgetRepository } from './budget.repo.sql';
import { createFileSystemSnapshotStorage, type SnapshotStorage } from './snapshotStorage';

const NOW = '2026-10-11T00:00:00.000Z';

const EXPENSE_CATEGORIES = ['cat-comida', 'cat-transporte', 'cat-casa', 'cat-salud', 'cat-ocio', 'cat-otros'];
const INCOME_CATEGORIES = ['cat-salario', 'cat-ingresos-otros'];
const CATEGORY_NAMES: Record<string, string> = {
  'cat-comida': 'Comida',
  'cat-transporte': 'Transporte',
  'cat-casa': 'Casa',
  'cat-salud': 'Salud',
  'cat-ocio': 'Ocio',
  'cat-otros': 'Otros',
  'cat-salario': 'Salario',
  'cat-ingresos-otros': 'Otros ingresos',
};

/** Idempotente: solo si la BD está vacía (un snapshot restaurado ya tiene datos). */
async function seedIfEmpty(db: SqlDbPort): Promise<void> {
  const rows = await db.select<{ n?: unknown }>('SELECT COUNT(*) AS n FROM accounts');
  if (Number(rows[0]?.n ?? 0) !== 0) return;
  const accounts: Array<[string, string, string]> = [
    ['acc-efectivo', 'Efectivo', 'cash'],
    ['acc-ahorro', 'Ahorro', 'savings'],
  ];
  for (const [id, name, type] of accounts) {
    await db.run(
      `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
       VALUES (?,?,?,'COP',0,?,?)`,
      [id, name, type, NOW, NOW],
    );
  }
  const expense = EXPENSE_CATEGORIES.map((id, i): [string, number] => [id, i]);
  for (const [id, i] of expense) {
    await db.run(
      `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
       VALUES (?,?,'expense',?,?,?)`,
      [id, CATEGORY_NAMES[id], i, NOW, NOW],
    );
  }
  const income = INCOME_CATEGORIES.map((id, i): [string, number] => [id, i]);
  for (const [id, i] of income) {
    await db.run(
      `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
       VALUES (?,?,'income',?,?,?)`,
      [id, CATEGORY_NAMES[id], i, NOW, NOW],
    );
  }
}

/** Crypto de bóveda (clave encapsulada) — KeyVaultPort cumple esta forma. */
export interface DevRepositoryCrypto {
  encryptBytes(data: Uint8Array): Promise<Uint8Array>;
  decryptBytes(payload: Uint8Array): Promise<Uint8Array>;
}

export interface DevRepositoryOptions {
  /** Crypto de la bóveda. Sin él no hay persistencia (arranque en RAM puro). */
  crypto?: DevRepositoryCrypto;
  /** Almacenamiento del snapshot (default: archivo de la app). */
  storage?: SnapshotStorage;
  /** Autoguardar tras cada evento (default true). */
  autoSave?: boolean;
  /** Motor de BD (default: expo-sqlite). Los tests inyectan el sql.js. */
  engine?: DevEngine;
}

export interface DevRepository {
  repo: SqlTransactionRepository;
  categories: SqlCategoryRepository;
  budgets: SqlBudgetRepository;
  db: DevDatabase;
  categoryNames: Record<string, string>;
  /** Fuerza un guardado del snapshot (además del autoguardado). */
  persist: () => Promise<void>;
  /** Desuscribe eventos y hace un guardado final (al desmontar el shell).
   *  `saveFinal=false` para el BORRADO TOTAL (HU-19): no recrear el snapshot. */
  dispose: (saveFinal?: boolean) => void;
}

/** Repo dev activa (para el borrado total F6 desde Ajustes). */
let activeDev: DevRepository | null = null;
export function getActiveDevRepository(): DevRepository | null {
  return activeDev;
}

const PERSIST_DEBOUNCE_MS = 400;

/** Abre la BD hidratando el snapshot (best-effort) o vacía si no hay. */
async function openWithSnapshot(engine: DevEngine, crypto?: DevRepositoryCrypto, storage?: SnapshotStorage): Promise<DevDatabase> {
  if (crypto && storage) {
    try {
      const blob = await storage.read();
      if (blob) {
        const bytes = await crypto.decryptBytes(blob); // GCM autentica: clave/corrupción → lanza
        return engine.open(bytes);
      }
    } catch {
      // Snapshot ilegible o con otra clave: empezar limpio (no bloquear).
      try {
        await storage.clear();
      } catch {
        // best-effort
      }
    }
  }
  return engine.open(null);
}

/** Crea la sesión: restaura snapshot (si hay clave) + migraciones + seed. */
export async function createDevRepository(opts: DevRepositoryOptions = {}): Promise<DevRepository> {
  const { crypto, autoSave = true } = opts;
  const storage = opts.storage ?? (crypto ? createFileSystemSnapshotStorage() : undefined);
  const engine = opts.engine ?? sqliteEngine();

  const db = await openWithSnapshot(engine, crypto, storage);

  await db.run('PRAGMA foreign_keys = ON');
  await runMigrations(portMigrationExecutor(db), MIGRATIONS);
  await seedIfEmpty(db);
  const repo = new SqlTransactionRepository(db);
  const categories = new SqlCategoryRepository(db);
  const budgets = new SqlBudgetRepository(db);

  const persist = async (): Promise<void> => {
    if (!crypto || !storage) return;
    try {
      const snapshot = await crypto.encryptBytes(await db.exportBytes());
      await storage.write(snapshot);
    } catch {
      // Mejor seguir en memoria que romper el flujo de usuario por disco lleno.
    }
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void persist();
    }, PERSIST_DEBOUNCE_MS);
  };

  const unsubscribe = autoSave && crypto && storage ? [repo.subscribe(schedule), categories.subscribe(schedule), budgets.subscribe(schedule)] : [];
  const appStateSub =
    autoSave && crypto && storage
      ? AppState.addEventListener('change', (state) => {
          if (state === 'background' || state === 'inactive') void persist();
        })
      : null;

  let disposed = false;
  const dev: DevRepository = {
    repo,
    categories,
    budgets,
    db,
    categoryNames: CATEGORY_NAMES,
    persist,
    dispose: (saveFinal = true) => {
      if (disposed) return; // idempotente (wipe + desmontaje del shell)
      disposed = true;
      unsubscribe.forEach((off) => off());
      appStateSub?.remove();
      if (timer) clearTimeout(timer);
      if (saveFinal) void persist(); // guardado final al desmontar
      else void db.close().catch(() => undefined); // sin snapshot: la BD en memoria no deja rastro
      if (activeDev === dev) activeDev = null;
    },
  };
  activeDev = dev;
  return dev;
}

export { CATEGORY_NAMES };
