/**
 * AES-256-GCM móvil (ADR-003) — @noble/ciphers puro.
 * Formato: iv(12) || ciphertext — mismo layout que la PWA. GCM autentica:
 * passphrase/clave equivocada → lanza al descifrar (verificador known-answer).
 */
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from './random';

const IV_BYTES = 12;

export async function encrypt(plaintext: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const iv = await randomBytes(IV_BYTES);
  const ct = gcm(key, iv).encrypt(plaintext);
  const out = new Uint8Array(IV_BYTES + ct.length);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return out;
}

export async function decrypt(payload: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  if (payload.length <= IV_BYTES) throw new Error('DECRYPT_INVALID_PAYLOAD');
  const iv = payload.subarray(0, IV_BYTES);
  const ct = payload.subarray(IV_BYTES);
  return gcm(key, iv).decrypt(ct);
}
