/**
 * VaultFile PWA (S7 · HU-14·15·16) — ExportPort/ImportPort sobre sql.js.
 * Cripto real con WebCrypto (PBKDF2-SHA256 120k + AES-256-GCM); espejo del
 * móvil (infrastructure/export/vaultFile.ts). El núcleo del formato vive en
 * @monedero/export-contract (único acoplamiento ADR-002).
 */
import type { Database } from 'sql.js';
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

const TABLES = EXPORT_ORDER;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cripto web: WebCrypto asíncrono (SubtleCrypto + getRandomValues). */
export const webFileCrypto: FileCrypto = {
  randomBytes: async (n) => {
    const bytes = new Uint8Array(n);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  },
  pbkdf2: async (passphrase, salt, iterations) => {
    const subtle = globalThis.crypto.subtle;
    const baseKey = await subtle.importKey('raw', encodeUtf8(passphrase) as BufferSource, 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
      baseKey,
      256,
    );
    return new Uint8Array(bits);
  },
  aesGcmEncrypt: async (plaintext, key, iv) => {
    const subtle = globalThis.crypto.subtle;
    const aesKey = await subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['encrypt']);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, aesKey, plaintext as BufferSource);
    return new Uint8Array(ct);
  },
  aesGcmDecrypt: async (ciphertext, key, iv) => {
    const subtle = globalThis.crypto.subtle;
    const aesKey = await subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['decrypt']);
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, aesKey, ciphertext as BufferSource);
    return new Uint8Array(pt);
  },
  sha256Hex: async (input) => {
    const bytes = typeof input === 'string' ? encodeUtf8(input) : input;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
    return toHex(new Uint8Array(digest));
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
  return buildMonederoFile(data, meta, webFileCrypto.sha256Hex);
}

/** Exporta la bóveda: `.monedero` plano o `.monedero.enc` cifrado (HU-14). */
export async function exportVaultFile(
  db: Database,
  meta: VaultFileMeta & { passphrase?: string },
): Promise<{ filename: string; content: string }> {
  const file = await buildVaultFile(db, meta);
  const date = file.exportedAt.slice(0, 10);
  if (meta.passphrase && meta.passphrase.length > 0) {
    const envelope = await encryptToEnvelope(file, meta.passphrase, webFileCrypto);
    return { filename: `monedero-${date}.monedero.enc`, content: JSON.stringify(envelope, null, 2) };
  }
  return { filename: `monedero-${date}.monedero`, content: JSON.stringify(file, null, 2) };
}

/** Aplica un plan a la BD en orden FK. Errores por fila → skipped. */
export function applyMergePlan(db: Database, plan: Pick<MergePlan, 'inserts' | 'updates'>, summary: ImportSummary): void {
  const applyRows = (collection: MonederoCollection, rows: DbRow[], kind: 'insert' | 'update'): void => {
    const columns = tableColumns(db, collection);
    for (const row of rows) {
      const present = columns.filter((col) => col in row && row[col] !== undefined);
      try {
        if (kind === 'insert') {
          if (collection === 'transaction_tags') {
            db.run(`INSERT OR IGNORE INTO ${collection} (transaction_id, tag_id) VALUES (?, ?)`, [
              String(row.transaction_id),
              String(row.tag_id),
            ]);
          } else if (collection === 'settings') {
            db.run(`INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)`, [
              String(row.key),
              String(row.value_json),
              String(row.updated_at),
            ]);
          } else {
            db.run(
              `INSERT INTO ${collection} (${present.join(', ')}) VALUES (${present.map(() => '?').join(', ')})`,
              present.map((col) => row[col] ?? null) as never,
            );
          }
        } else {
          const setCols = columns.filter((col) => col !== 'id' && col in row);
          db.run(
            `UPDATE ${collection} SET ${setCols.map((c2) => `${c2} = ?`).join(', ')} WHERE id = ?`,
            [...setCols.map((col) => row[col] ?? null), String(row.id)] as never,
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
    sha256Hex: webFileCrypto.sha256Hex,
    crypto: webFileCrypto,
  });

  const existing = Object.fromEntries(TABLES.map((t) => [t, readTable(db, t)])) as Record<
    MonederoCollection,
    DbRow[]
  >;

  const replacePlan = opts.mode === 'replace' ? planReplace(file.data) : null;
  const plan = replacePlan
    ? { inserts: replacePlan.inserts, updates: [], summary: replacePlan.summary }
    : planMerge(file.data, existing);

  if (opts.mode === 'replace') wipeCollections(db);
  applyMergePlan(db, plan, plan.summary);

  try {
    db.run(
      `INSERT INTO import_log (id, source, file_hash, summary_json, imported_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        `imp-${Date.now()}`,
        opts.source ?? 'pwa',
        file.integrity.sha256,
        JSON.stringify(plan.summary),
        new Date().toISOString(),
      ],
    );
  } catch {
    // best-effort
  }

  return plan.summary;
}
