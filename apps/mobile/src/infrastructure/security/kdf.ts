/**
 * KDF móvil — PBKDF2-HMAC-SHA256, 120.000 iteraciones (ESTANDAR ADR-003).
 * @noble/hashes puro (sin nativos): pbkdf2Async cede el hilo para no congelar
 * la UI durante la derivación. Mismos parámetros que la PWA (WebCrypto).
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { randomBytes } from './random';

const ITERATIONS = 120_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

export interface DerivedKey {
  key: Uint8Array;
  salt: Uint8Array;
}

/** Genera un salt aleatorio (16 bytes) y deriva la clave maestra. */
export async function createVaultKey(passphrase: string): Promise<DerivedKey> {
  const salt = await randomBytes(SALT_BYTES);
  const key = await deriveKey(passphrase, salt);
  return { key, salt };
}

/** Deriva la clave AES-256 desde passphrase + salt (120k iteraciones).
 * asyncTick=100: cede el hilo cada ≤100 ms (el spinner «Descifrando…» se pinta
 * y los timers respiran) sin el coste enorme del tick por defecto (10 ms: 3×). */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(passphrase), salt, {
    c: ITERATIONS,
    dkLen: KEY_BYTES,
    asyncTick: 100,
  });
}
