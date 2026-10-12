/**
 * Tests TDD — cripto móvil de la bóveda (plan 2.3): PBKDF2 120k (@noble) +
 * AES-256-GCM (@noble) con el mismo layout que la PWA (iv(12) || ct).
 * Fuente: ESTANDAR/CONTRATOS_API seguridad · ADR-003.
 */
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { createVaultKey, deriveKey } from '../../src/infrastructure/security/kdf';
import { decrypt, encrypt } from '../../src/infrastructure/security/aesGcm';
import { randomBytes } from '../../src/infrastructure/security/random';

describe('kdf móvil — PBKDF2-HMAC-SHA256 120k (ADR-003)', () => {
  it('createVaultKey → salt de 16 bytes + clave de 32 bytes', async () => {
    const { key, salt } = await createVaultKey('clave-maestra-1');
    expect(salt).toHaveLength(16);
    expect(key).toHaveLength(32);
  });

  it('la misma passphrase + salt produce la MISMA clave (determinista)', async () => {
    const salt = await randomBytes(16);
    const a = await deriveKey('clave-maestra-1', salt);
    const b = await deriveKey('clave-maestra-1', salt);
    expect(bytesToHex(a)).toBe(bytesToHex(b));
  });

  it('passphrases distintas → claves distintas (PBKDF2 deriva otra, por eso el verificador)', async () => {
    const salt = await randomBytes(16);
    const a = await deriveKey('clave-maestra-1', salt);
    const b = await deriveKey('clave-maestra-2', salt);
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });

  it('salts distintos → claves distintas', async () => {
    const a = await deriveKey('clave-maestra-1', await randomBytes(16));
    const b = await deriveKey('clave-maestra-1', await randomBytes(16));
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });
});

describe('aesGcm móvil — AES-256-GCM (iv(12) || ct)', () => {
  it('roundtrip: cifra y descifra el mismo plaintext', async () => {
    const { key } = await createVaultKey('clave-maestra-1');
    const pt = utf8ToBytes('monedero-vault-ok-v1');
    const payload = await encrypt(pt, key);
    const out = await decrypt(payload, key);
    expect(bytesToHex(out)).toBe(bytesToHex(pt));
  });

  it('el payload lleva iv de 12 bytes como prefijo y cifrado tras él', async () => {
    const { key } = await createVaultKey('clave-maestra-1');
    const payload = await encrypt(utf8ToBytes('hola'), key);
    expect(payload.length).toBe(12 + utf8ToBytes('hola').length + 16); // iv + ct + tag GCM
  });

  it('el iv es aleatorio: dos cifrados del mismo dato difieren', async () => {
    const { key } = await createVaultKey('clave-maestra-1');
    const pt = utf8ToBytes('mismo dato');
    const [a, b] = [await encrypt(pt, key), await encrypt(pt, key)];
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });

  it('LANZA con clave equivocada (GCM auth fail) — verificador de passphrase', async () => {
    const { key } = await createVaultKey('clave-maestra-1');
    const { key: wrong } = await createVaultKey('clave-maestra-2');
    const payload = await encrypt(utf8ToBytes('secreto'), key);
    await expect(decrypt(payload, wrong)).rejects.toThrow();
  });

  it('LANZA con payload demasiado corto (sin iv completo)', async () => {
    const { key } = await createVaultKey('clave-maestra-1');
    await expect(decrypt(new Uint8Array(8), key)).rejects.toThrow('DECRYPT_INVALID_PAYLOAD');
  });
});
