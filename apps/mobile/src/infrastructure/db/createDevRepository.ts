/**
 * createDevRepository — fábrica de repos sobre sql.js (asm.js) con
 * PERSISTENCIA CIFRADA INTERINA (ADR-003):
 *  - al arrancar se restaura el último snapshot sellado con la clave de bóveda
 *    (AES-256-GCM) desde el archivo de la app;
 *  - tras cada evento de escritura (movimientos/categorías/presupuestos) y al
 *    pasar a segundo plano, se exporta la BD y se guarda el blob cifrado;
 *  - snapshot ilegible o clave distinta → se descarta y se empieza limpio
 *    (misma semántica que la bóveda: mejor crear de nuevo que bloquear).
 * La clave maestra NUNCA sale de KeyVault (encryptBytes/decryptBytes).
 * Al llegar el dev-build con SQLCipher, esta fábrica se sustituye por el
 * adaptador nativo; la UI y los stores no cambian (hexagonal).
 */
import { AppState } from 'react-native';
import initSqlJs from './sqlasm'; // asm.js: Metro/Expo Go no resuelven node:fs del build wasm
import type { Database } from 'sql.js';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import { sqlJsDb } from './sqljsAdapter';
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
function seedIfEmpty(db: Database): void {
  const accounts = db.exec('SELECT COUNT(*) FROM accounts');
  if (Number(accounts[0]?.values[0]?.[0] ?? 0) !== 0) return;
  db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-efectivo','Efectivo','cash','COP',0,'${NOW}','${NOW}')`,
  );
  db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-ahorro','Ahorro','savings','COP',0,'${NOW}','${NOW}')`,
  );
  EXPENSE_CATEGORIES.forEach((id, i) => {
    db.run(
      `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
       VALUES ('${id}','${CATEGORY_NAMES[id]}','expense',${i},'${NOW}','${NOW}')`,
    );
  });
  INCOME_CATEGORIES.forEach((id, i) => {
    db.run(
      `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
       VALUES ('${id}','${CATEGORY_NAMES[id]}','income',${i},'${NOW}','${NOW}')`,
    );
  });
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
}

export interface DevRepository {
  repo: SqlTransactionRepository;
  categories: SqlCategoryRepository;
  budgets: SqlBudgetRepository;
  db: Database;
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

/** Crea la repo: restaura snapshot (si hay clave) + migraciones + seed. */
export async function createDevRepository(opts: DevRepositoryOptions = {}): Promise<DevRepository> {
  const { crypto, autoSave = true } = opts;
  const storage = opts.storage ?? (crypto ? createFileSystemSnapshotStorage() : undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  let db = new SQL.Database();

  // ── Restauración del snapshot cifrado (best-effort) ──
  if (crypto && storage) {
    try {
      const blob = await storage.read();
      if (blob) {
        const bytes = await crypto.decryptBytes(blob); // GCM autentica: clave/corrupción → lanza
        const restored = new SQL.Database(bytes); // construir ANTES de cerrar el actual
        db.close();
        db = restored;
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

  db.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
  seedIfEmpty(db);
  const port = sqlJsDb(db); // UNA abstracción SqlDbPort compartida por los repos
  const repo = new SqlTransactionRepository(port);
  const categories = new SqlCategoryRepository(port);
  const budgets = new SqlBudgetRepository(port);

  const persist = async (): Promise<void> => {
    if (!crypto || !storage) return;
    try {
      const snapshot = await crypto.encryptBytes(db.export());
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
      else {
        try {
          db.close();
        } catch {
          // ya cerrada
        }
      }
      if (activeDev === dev) activeDev = null;
    },
  };
  activeDev = dev;
  return dev;
}

export { CATEGORY_NAMES };
