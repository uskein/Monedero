/**
 * Fichero .monedero — build + verificación de integridad (S7 · HU-14).
 * Regla de integridad (CONTRATOS §integridad): integrity.sha256 =
 * SHA-256 del JSON CANÓNICO del fichero SIN la propia colección integrity
 * (el verificador la elimina, canoniza y recalcula). El SHA-256 se inyecta
 * por plataforma (WebCrypto en la PWA, @noble en móvil).
 */
import { FORMAT_VERSION, type MonederoCollection, type MonederoFile } from './types';
import { canonicalize } from './hash';
import { MonederoFileSchema } from './schemas';
import { migrate } from './migrations';

export type Sha256Hex = (canonical: string) => Promise<string>;

/** Colecciones en orden de APLICACIÓN (dependencias FK primero). */
export const EXPORT_ORDER: MonederoCollection[] = [
  'settings',
  'accounts',
  'categories',
  'tags',
  'transactions',
  'budgets',
  'transaction_tags',
];

function withoutIntegrity(file: Record<string, unknown>): Record<string, unknown> {
  const { integrity: _integrity, ...rest } = file;
  return rest;
}

/** Construye el fichero v1 con su integrity (hash del canónico sin integrity). */
export async function buildMonederoFile(
  data: Record<MonederoCollection, unknown[]>,
  meta: { vaultId: string; currency: string; exportedAt?: string },
  sha256Hex: Sha256Hex,
): Promise<MonederoFile> {
  const base = {
    formatVersion: FORMAT_VERSION,
    exportedAt: meta.exportedAt ?? new Date().toISOString(),
    vaultId: meta.vaultId,
    currency: meta.currency.toUpperCase(),
    data,
  };
  const sha256 = await sha256Hex(canonicalize(base));
  const file = { ...base, integrity: { sha256 } };
  return MonederoFileSchema.parse(file) as MonederoFile;
}

/** ¿El integrity.sha256 del fichero es válido? (sin tocar datos). */
export async function verifyMonederoIntegrity(
  file: { integrity?: { sha256?: string } } & Record<string, unknown>,
  sha256Hex: Sha256Hex,
): Promise<boolean> {
  const expected = file.integrity?.sha256;
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) return false;
  const actual = await sha256Hex(canonicalize(withoutIntegrity(file)));
  return actual === expected;
}

/** Valida el fichero ya descifrado: schema + migración forward-only. */
export function parseMonederoFileJson(json: unknown): MonederoFile {
  const migrated = migrate(json as { formatVersion: number });
  return MonederoFileSchema.parse(migrated) as MonederoFile;
}
