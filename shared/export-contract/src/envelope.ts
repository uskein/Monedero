/**
 * Envoltorio cifrado .monedero.enc (S7 · HU-14).
 * PBKDF2-SHA256 (120k, misma familia que la bóveda) + AES-256-GCM con IV
 * aleatorio; la passphrase NUNCA viaja en el fichero (solo salt/iv).
 * El integrity.sha256 cubre el ENVOLTORIO SIN integrity → se verifica ANTES
 * de descifrar (F5: IMPORT_HASH_MISMATCH antes que IMPORT_DECRYPT_FAILED).
 * La criptografía se inyecta por plataforma (WebCrypto / @noble).
 */
import type { MonederoFile } from './types';
import { canonicalize } from './hash';
import { bytesToBase64, base64ToBytes } from './base64';
import { encodeUtf8, decodeUtf8 } from './utf8';
import { buildMonederoFile, parseMonederoFileJson, verifyMonederoIntegrity, type Sha256Hex } from './file';

export const ENVELOPE_MAGIC = 'MONEDERO-ENC-1';
/** Iteraciones PBKDF2 del fichero (consistente con la bóveda). */
export const FILE_KDF_ITERATIONS = 120_000;

export interface EncryptedEnvelope {
  magic: typeof ENVELOPE_MAGIC;
  encrypted: true;
  formatVersion: 1;
  kdf: { name: 'PBKDF2'; digest: 'SHA-256'; salt: string; iterations: number };
  iv: string;
  ciphertext: string;
  integrity: { sha256: string };
}

/** Cripto nativa por plataforma (inyectada). */
export interface FileCrypto {
  randomBytes(n: number): Promise<Uint8Array>;
  pbkdf2(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array>;
  aesGcmEncrypt(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array>;
  aesGcmDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array>;
  sha256Hex: Sha256Hex;
}

function envelopeWithoutIntegrity(env: EncryptedEnvelope): Record<string, unknown> {
  const { integrity: _i, ...rest } = env;
  return rest;
}

/** Cifra un fichero validado a un envoltorio `.enc` con integrity. */
export async function encryptToEnvelope(
  file: MonederoFile,
  passphrase: string,
  crypto: FileCrypto,
): Promise<EncryptedEnvelope> {
  if (passphrase.length < 8) throw new Error('VALIDATION_FAILED');
  const salt = await crypto.randomBytes(16);
  const iv = await crypto.randomBytes(12);
  const key = await crypto.pbkdf2(passphrase, salt, FILE_KDF_ITERATIONS);
  const plaintext = encodeUtf8(JSON.stringify(file));
  const ciphertext = await crypto.aesGcmEncrypt(plaintext, key, iv);
  const base: Omit<EncryptedEnvelope, 'integrity'> = {
    magic: ENVELOPE_MAGIC,
    encrypted: true,
    formatVersion: 1,
    kdf: { name: 'PBKDF2', digest: 'SHA-256', salt: bytesToBase64(salt), iterations: FILE_KDF_ITERATIONS },
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
  const sha256 = await crypto.sha256Hex(canonicalize(base));
  return { ...base, integrity: { sha256 } };
}

/** Descifra y valida un envoltorio. Errores: IMPORT_* (ver mensaje). */
export async function openEnvelope(
  envelope: EncryptedEnvelope,
  passphrase: string,
  crypto: FileCrypto,
): Promise<MonederoFile> {
  if (envelope.magic !== ENVELOPE_MAGIC) throw new Error('IMPORT_FORMAT_UNSUPPORTED');
  // 1) Integridad del envoltorio (antes de cualquier descifrado).
  if (!(await verifyMonederoIntegrity(envelope, crypto.sha256Hex))) {
    throw new Error('IMPORT_HASH_MISMATCH');
  }
  // 2) Descifrado (GCM autentica: passphrase incorrecta → IMPORT_DECRYPT_FAILED).
  let plaintext: Uint8Array;
  try {
    const salt = base64ToBytes(envelope.kdf.salt);
    const iv = base64ToBytes(envelope.iv);
    const key = await crypto.pbkdf2(passphrase, salt, envelope.kdf.iterations);
    plaintext = await crypto.aesGcmDecrypt(base64ToBytes(envelope.ciphertext), key, iv);
  } catch {
    throw new Error('IMPORT_DECRYPT_FAILED');
  }
  // 3) Estructura del contenido.
  let json: unknown;
  try {
    json = JSON.parse(decodeUtf8(plaintext));
  } catch {
    throw new Error('IMPORT_FORMAT_UNSUPPORTED');
  }
  return parseMonederoFileJson(json);
}

export { buildMonederoFile, verifyMonederoIntegrity };
