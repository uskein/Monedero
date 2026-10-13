/**
 * VaultFile móvil (S7 · HU-14·15·16) — ExportPort/ImportPort sobre sql.js.
 * Cripto real con @noble (PBKDF2-SHA256 120k + AES-256-GCM, misma familia
 * que la bóveda). El núcleo del formato vive en @monedero/export-contract
 * (único acoplamiento ADR-002); aquí solo hay glue de BD y archivos.
 * El frontend jamás escribe SQL: la UI llama a exportVaultFile/importVaultFile.
 */
import type { Database, SqlValue } from 'sql.js';
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

/** Lee una tabla completa como filas (snake_case). */
export function readTable(db: Database, table: string): DbRow[] {
  const first = db.exec(`SELECT * FROM ${table}`)?.[0];
  if (!first) return [];
  const { columns, values } = first;
  return values.map((row) => Object.fromEntries(columns.map((col: string, i: number) => [col, row[i] ?? null])));
}

function tableColumns(db: Database, table: string): string[] {
  const info = db.exec(`PRAGMA table_info(${table})`)?.[0];
  if (!info) return [];
  return info.values.map((row) => String(row[1])); // [cid, name, type, ...]
}

export interface VaultFileMeta {
  vaultId: string;
  currency: string;
}

/** Serializa TODA la bóveda a MonederoFile (con integrity). */
export async function buildVaultFile(db: Database, meta: VaultFileMeta): Promise<MonederoFile> {
  const data = Object.fromEntries(TABLES.map((t) => [t, readTable(db, t)])) as Record<
    MonederoCollection,
    unknown[]
  >;
  return buildMonederoFile(data, meta, nobleFileCrypto.sha256Hex);
}

/** Exporta la bóveda: `.monedero` plano o `.monedero.enc` cifrado (HU-14). */
export async function exportVaultFile(
  db: Database,
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
export function applyMergePlan(db: Database, plan: Pick<MergePlan, 'inserts' | 'updates'>, summary: ImportSummary): void {
  db.run('PRAGMA foreign_keys = ON');
  const applyRows = (collection: MonederoCollection, rows: DbRow[], kind: 'insert' | 'update'): void => {
    const columns = tableColumns(db, collection);
    for (const row of rows) {
      const present = columns.filter((col) => col in row && row[col] !== undefined);
      try {
        if (kind === 'insert') {
          if (collection === 'transaction_tags') {
            db.run(
              `INSERT OR IGNORE INTO ${collection} (transaction_id, tag_id) VALUES (?, ?)`,
              [String(row.transaction_id), String(row.tag_id)],
            );
          } else if (collection === 'settings') {
            db.run(
              `INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)`,
              [String(row.key), String(row.value_json), String(row.updated_at)],
            );
          } else {
            db.run(
              `INSERT INTO ${collection} (${present.join(', ')}) VALUES (${present.map(() => '?').join(', ')})`,
              present.map((col) => row[col] ?? null) as SqlValue[],
            );
          }
        } else {
          const setCols = columns.filter((col) => col !== 'id' && col in row);
          db.run(
            `UPDATE ${collection} SET ${setCols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
            [...setCols.map((col) => row[col] ?? null), String(row.id)] as SqlValue[],
          );
        }
      } catch {
        summary.skipped += 1;
        summary.reasons.APLICACION_FALLIDA = (summary.reasons.APLICACION_FALLIDA ?? 0) + 1;
      }
    }
  };

  db.run('PRAGMA foreign_keys = OFF'); // tolera archivos con FKs rotas por fila
  try {
    for (const step of plan.inserts) applyRows(step.collection, step.rows, 'insert');
    for (const step of plan.updates) applyRows(step.collection, step.rows, 'update');
  } finally {
    db.run('PRAGMA foreign_keys = ON');
  }
}

/** Vacía las colecciones (HU-16 reemplazar) respetando FKs (hijos primero). */
export function wipeCollections(db: Database): void {
  db.run('PRAGMA foreign_keys = OFF');
  try {
    for (const table of [...TABLES].reverse()) {
      db.run(`DELETE FROM ${table}`);
    }
  } finally {
    db.run('PRAGMA foreign_keys = ON');
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
  db: Database,
  raw: string | Uint8Array,
  opts: ImportOptions,
): Promise<ImportSummary> {
  const { file } = await parseMonederoInput(raw, {
    passphrase: opts.passphrase,
    sha256Hex: nobleFileCrypto.sha256Hex,
    crypto: nobleFileCrypto,
  });

  const existing = Object.fromEntries(TABLES.map((t) => [t, readTable(db, t)])) as Record<
    MonederoCollection,
    DbRow[]
  >;

  const plan =
    opts.mode === 'replace'
      ? { inserts: planReplace(file.data).inserts, updates: [], summary: planReplace(file.data).summary }
      : planMerge(file.data, existing);

  if (opts.mode === 'replace') wipeCollections(db);
  applyMergePlan(db, plan, plan.summary);

  // Auditoría local (import_log es local y NUNCA se exporta).
  try {
    db.run(
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
