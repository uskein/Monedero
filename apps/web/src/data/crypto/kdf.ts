/**
 * KDF — PBKDF2-HMAC-SHA256, 120.000 iteraciones (ESTANDAR de seguridad ADR-003).
 * WebCrypto asíncrono, 100% local. Fuente: ESTANDAR/CONTRATOS_API §seguridad.
 */
const ITERATIONS = 120_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

export interface DerivedKey {
  key: CryptoKey;
  salt: Uint8Array;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Genera un salt aleatorio (16 bytes). */
export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/** Deriva una clave AES-GCM desde passphrase + salt. */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Crea bóveda: salt aleatorio + clave derivada; devuelve ambas para persistir. */
export async function createVaultKey(passphrase: string): Promise<DerivedKey> {
  const salt = randomSalt();
  const key = await deriveKey(passphrase, salt);
  return { key, salt };
}

/** Fingerprint corto del salt para detectar passphrase incorrecta sin descifrar todo. */
export function saltFingerprint(salt: Uint8Array): string {
  return toHex(salt).slice(0, 8);
}
