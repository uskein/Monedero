/**
 * Test crypto — KDF + AES-GCM (ESTRATEGIA_PRUEBAS §5: TDD área crítica).
 * Gate: roundtrip y rechazo de passphrase incorrecta (HU-01/HU-02).
 */
import { describe, it, expect } from 'vitest';
import { createVaultKey, deriveKey, randomSalt } from '../src/data/crypto/kdf';
import { decrypt, encrypt, sha256Hex } from '../src/data/crypto/aesGcm';

const enc = new TextEncoder();

describe('PBKDF2 (120k iteraciones)', () => {
  // Claves no extraíbles (extractable=false, por diseño): la determinismo se
  // demuestra conductualmente — descifrar con la re-derivación debe funcionar.
  it('deriva clave determinista: re-derivar mismo salt+passphrase descifra', async () => {
    const salt = randomSalt();
    const k1 = await deriveKey('clave-secreta-123', salt);
    const k2 = await deriveKey('clave-secreta-123', salt);
    const ct = await encrypt(enc.encode('payload'), k1);
    const pt = await decrypt(ct, k2);
    expect(new TextDecoder().decode(pt)).toBe('payload');
  });

  it('passphrase distinta → NO descifra (clave distinta)', async () => {
    const salt = randomSalt();
    const kA = await deriveKey('passphrase-A', salt);
    const kB = await deriveKey('passphrase-B', salt);
    const ct = await encrypt(enc.encode('payload'), kA);
    await expect(decrypt(ct, kB)).rejects.toThrow();
  });

  it('createVaultKey genera salt aleatorio de 16 bytes', async () => {
    const { key, salt } = await createVaultKey('otra-clave-8ch');
    expect(salt.length).toBe(16);
    expect(key.algorithm.name).toBe('AES-GCM');
  });
});

describe('AES-256-GCM', () => {
  it('roundtrip: cifra y descifra idéntico', async () => {
    const { key } = await createVaultKey('passphrase-roundtrip');
    const plain = enc.encode('datos sensibles del usuario');
    const ct = await encrypt(plain, key);
    expect(ct.length).toBeGreaterThan(plain.length);
    const pt = await decrypt(ct, key);
    expect(new TextDecoder().decode(pt)).toBe('datos sensibles del usuario');
  });

  it('la misma plaintext produce ciphertext distinto (iv aleatorio)', async () => {
    const { key } = await createVaultKey('passphrase-iv');
    const plain = enc.encode('igual');
    const c1 = await encrypt(plain, key);
    const c2 = await encrypt(plain, key);
    expect(new Uint8Array(c1)).not.toEqual(new Uint8Array(c2));
  });

  it('LANZA con clave equivocada (GCM auth fail) — verificador de passphrase', async () => {
    const { key: correct } = await createVaultKey('correcta-1234');
    const { key: wrong } = await createVaultKey('incorrecta-1234');
    const ct = await encrypt(enc.encode('known'), correct);
    await expect(decrypt(ct, wrong)).rejects.toThrow();
  });

  it('rechaza payload truncado', async () => {
    const { key } = await createVaultKey('passphrase-trunc');
    await expect(decrypt(new Uint8Array(4), key)).rejects.toThrow('DECRYPT_INVALID_PAYLOAD');
  });
});

describe('sha256Hex (integridad .monedero)', () => {
  it('hash determinista de 64 hex', async () => {
    const h = await sha256Hex('{"formatVersion":1}');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex('{"formatVersion":1}')).toBe(h);
  });

  it('hash distinto para datos distintos', async () => {
    expect(await sha256Hex('a')).not.toBe(await sha256Hex('b'));
  });
});
