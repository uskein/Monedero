/**
 * Parseo de entrada del import (S7 · HU-15) — acepta `.monedero` (JSON) o
 * `.monedero.enc` (envoltorio cifrado). Orden F5: esquema → hash → decrypt:
 *  - JSON ilegible / versión futura / schema inválido → IMPORT_FORMAT_UNSUPPORTED
 *  - integrity inválido (fichero o envoltorio) → IMPORT_HASH_MISMATCH
 *  - envoltorio sin passphrase → PASSPHRASE_REQUIRED
 *  - GCM falla (passphrase equivocada) → IMPORT_DECRYPT_FAILED
 */
import type { MonederoFile } from './types';
import { decodeUtf8 } from './utf8';
import { parseMonederoFileJson, verifyMonederoIntegrity, type Sha256Hex } from './file';
import { openEnvelope, type EncryptedEnvelope, type FileCrypto } from './envelope';

export interface ParsedMonederoInput {
  file: MonederoFile;
  encrypted: boolean;
}

export function isEncryptedEnvelope(json: unknown): json is EncryptedEnvelope {
  return typeof json === 'object' && json !== null && (json as { encrypted?: unknown }).encrypted === true;
}

export async function parseMonederoInput(
  raw: string | Uint8Array,
  opts: { passphrase?: string; sha256Hex: Sha256Hex; crypto?: FileCrypto },
): Promise<ParsedMonederoInput> {
  const text = typeof raw === 'string' ? raw : decodeUtf8(raw);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('IMPORT_FORMAT_UNSUPPORTED');
  }
  if (typeof json !== 'object' || json === null) {
    throw new Error('IMPORT_FORMAT_UNSUPPORTED');
  }

  if (isEncryptedEnvelope(json)) {
    if (!opts.crypto) throw new Error('IMPORT_FORMAT_UNSUPPORTED');
    if (!opts.passphrase || opts.passphrase.length === 0) throw new Error('PASSPHRASE_REQUIRED');
    const file = await openEnvelope(json, opts.passphrase, opts.crypto);
    return { file, encrypted: true };
  }

  if (!(await verifyMonederoIntegrity(json as Record<string, unknown>, opts.sha256Hex))) {
    throw new Error('IMPORT_HASH_MISMATCH');
  }
  try {
    return { file: parseMonederoFileJson(json), encrypted: false };
  } catch {
    // v0.x migrada ok o schema inválido/futura → formato no soportado.
    throw new Error('IMPORT_FORMAT_UNSUPPORTED');
  }
}
