/**
 * VaultFile móvil (S7 · HU-14·15·16) — ExportPort/ImportPort sobre SqlDbPort.
 * Cripto real con @noble (PBKDF2-SHA256 120k + AES-256-GCM, misma familia
 * que la bóveda). El núcleo del formato vive en @monedero/export-contract
 * (único acoplamiento ADR-002); aquí solo hay glue de BD y archivos.
 * La BD llega por el PUERTO SqlDbPort: expo-sqlite (runtime) o sql.js (jest)
 * — la lógica de export/import es idéntica en ambos (D1).
 * El frontend jamás escribe SQL: la UI llama a exportVaultFile/importVaultFile.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  EXPORT_ORDER,
  buildMonederoFile,
  encodeUtf8,
  encryptToEnvelope,
  parseMonederoInput,
  planMerge,
  planReplace,
  type DbRow,
  type FileCrypto,
  type ImportSummary,
  type MergePlan,
  type MonederoCollection,
  type MonederoFile,
} from '@monedero/export-contract';
import type { SqlDbPort } from '../db/SqlDbPort';
import { randomBytes } from '../security/random';

const TABLES = EXPORT_ORDER;

/** Cripto móvil: @noble puro (funciona en Hermes y en jest). */
export const nobleFileCrypto: FileCrypto = {
  randomBytes,
  pbkdf2: async (passphrase, salt, iterations) =>
    pbkdf2(sha256, encodeUtf8(passphrase), salt, { c: iterations, dkLen: 32 }),
  aesGcmEncrypt: async (plaintext, key, iv) => gcm(key, iv).encrypt(plaintext),
  aesGcmDecrypt: async (ciphertext, key, iv) => gcm(key, iv).decrypt(ciphertext),
  sha256Hex: async (input) => {
    const bytes = typeof input === 'string' ? encodeUtf8(input) : input;
    return bytesToHex(sha256(bytes));
  },
};

/** Lee una tabla completa como filas (snake_case, nulls normalizados). */
export async function readTable(db: SqlDbPort, table: string): Promise<DbRow[]> {
  const rows = await db.select(`SELECT * FROM ${table}`);
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([col, v]) => [col, v ?? null])));
}

async function tableColumns(db: SqlDbPort, table: string): Promise<string[]> {
  const info = await db.select<{ name?: unknown }>(`PRAGMA table_info(${table})`);
  return info.map((row) => String(row.name));
}

export interface VaultFileMeta {
  vaultId: string;
  currency: string;
}

/** Serializa TODA la bóveda a MonederoFile (con integrity). */
export async function buildVaultFile(db: SqlDbPort, meta: VaultFileMeta): Promise<MonederoFile> {
  const data: [string, DbRow[]][] = [];
  for (const t of TABLES) data.push([t, await readTable(db, t)]);
  return buildMonederoFile(Object.fromEntries(data) as Record<MonederoCollection, unknown[]>, meta, nobleFileCrypto.sha256Hex);
}

/** Exporta la bóveda: `.monedero` plano o `.monedero.enc` cifrado (HU-14). */
export async function exportVaultFile(
  db: SqlDbPort,
  meta: VaultFileMeta & { passphrase?: string },
): Promise<{ filename: string; content: string }> {
  const file = await buildVaultFile(db, meta);
  const date = file.exportedAt.slice(0, 10);
  if (meta.passphrase && meta.passphrase.length > 0) {
    const envelope = await encryptToEnvelope(file, meta.passphrase, nobleFileCrypto);
    return { filename: `monedero-${date}.monedero.enc`, content: JSON.stringify(envelope, null, 2) };
  }
  return { filename: `monedero-${date}.monedero`, content: JSON.stringify(file, null, 2) };
}

/** Aplica un plan a la BD en orden FK. Errores por fila → skipped. */
export async function applyMergePlan(
  db: SqlDbPort,
  plan: Pick<MergePlan, 'inserts' | 'updates'>,
  summary: ImportSummary,
): Promise<void> {
  await db.run('PRAGMA foreign_keys = ON');
  const applyRows = async (collection: MonederoCollection, rows: DbRow[], kind: 'insert' | 'update'): Promise<void> => {
    const columns = await tableColumns(db, collection);
    for (const row of rows) {
      const present = columns.filter((col) => col in row && row[col] !== undefined);
      try {
        if (kind === 'insert') {
          if (collection === 'transaction_tags') {
            await db.run(
              `INSERT OR IGNORE INTO ${collection} (transaction_id, tag_id) VALUES (?, ?)`,
              [String(row.transaction_id), String(row.tag_id)],
            );
          } else if (collection === 'settings') {
            await db.run(
              `INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)`,
              [String(row.key), String(row.value_json), String(row.updated_at)],
            );
          } else {
            await db.run(
              `INSERT INTO ${collection} (${present.join(', ')}) VALUES (${present.map(() => '?').join(', ')})`,
              present.map((col) => row[col] ?? null),
            );
          }
        } else {
          const setCols = columns.filter((col) => col !== 'id' && col in row);
          await db.run(
            `UPDATE ${collection} SET ${setCols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
            [...setCols.map((col) => row[col] ?? null), String(row.id)],
          );
        }
      } catch {
        summary.skipped += 1;
        summary.reasons.APLICACION_FALLIDA = (summary.reasons.APLICACION_FALLIDA ?? 0) + 1;
      }
    }
  };

  await db.run('PRAGMA foreign_keys = OFF'); // tolera archivos con FKs rotas por fila
  try {
    for (const step of plan.inserts) await applyRows(step.collection, step.rows, 'insert');
    for (const step of plan.updates) await applyRows(step.collection, step.rows, 'update');
  } finally {
    await db.run('PRAGMA foreign_keys = ON');
  }
}

/** Vacía las colecciones (HU-16 reemplazar) respetando FKs (hijos primero). */
export async function wipeCollections(db: SqlDbPort): Promise<void> {
  await db.run('PRAGMA foreign_keys = OFF');
  try {
    for (const table of [...TABLES].reverse()) {
      await db.run(`DELETE FROM ${table}`);
    }
  } finally {
    await db.run('PRAGMA foreign_keys = ON');
  }
}

export interface ImportOptions {
  mode: 'merge' | 'replace';
  passphrase?: string;
  /** Origen para el import_log (HU-16/audit). */
  source?: 'mobile' | 'pwa';
}

/** Importa un `.monedero`/`.monedero.enc` (HU-15·16). Lanza con IMPORT_*. */
export async function importVaultFile(
  db: SqlDbPort,
  raw: string | Uint8Array,
  opts: ImportOptions,
): Promise<ImportSummary> {
  const { file } = await parseMonederoInput(raw, {
    passphrase: opts.passphrase,
    sha256Hex: nobleFileCrypto.sha256Hex,
    crypto: nobleFileCrypto,
  });

  const existing: Record<MonederoCollection, DbRow[]> = {} as Record<MonederoCollection, DbRow[]>;
  for (const t of TABLES) existing[t] = await readTable(db, t);

  const plan =
    opts.mode === 'replace'
      ? { inserts: planReplace(file.data).inserts, updates: [], summary: planReplace(file.data).summary }
      : planMerge(file.data, existing);

  if (opts.mode === 'replace') await wipeCollections(db);
  await applyMergePlan(db, plan, plan.summary);

  // Auditoría local (import_log es local y NUNCA se exporta).
  try {
    await db.run(
      `INSERT INTO import_log (id, source, file_hash, summary_json, imported_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        `imp-${Date.now()}`,
        opts.source ?? 'mobile',
        file.integrity.sha256,
        JSON.stringify(plan.summary),
        new Date().toISOString(),
      ],
    );
  } catch {
    // best-effort: el resumen del import es lo importante
  }

  return plan.summary;
}
