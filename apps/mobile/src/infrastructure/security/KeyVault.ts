/**
 * KeyVault — implementación móvil de KeyVaultPort (plan 2.3, TDD).
 * PBKDF2 120k + AES-256-GCM con verificador known-answer: PBKDF2 NO falla con
 * una passphrase equivocada (deriva otra clave), por eso se descifra un
 * known-answer almacenado — mismo diseño que la PWA.
 * El almacenamiento se inyecta (SecureStore en prod, memoria en tests); los
 * metadatos viven en caché tras load() para que hasVault() sea síncrono.
 */
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { DomainError } from '../../core/errors';
import type { KeyVaultPort } from '../../core/ports/KeyVaultPort';
import type { VaultStorage } from '../../core/ports/VaultStorage';
import { decrypt, encrypt } from './aesGcm';
import { createVaultKey, deriveKey } from './kdf';

const MIN_LEN = 8;
/** known-answer cifrado: solo lo descifra la passphrase correcta (GCM autentica). */
const KNOWN = utf8ToBytes('monedero-vault-ok-v1');
/** Mismas claves que la PWA (futuro export/import de bóveda). */
const KEYS = {
  salt: 'monedero.vault.salt',
  verifier: 'monedero.vault.verifier',
  id: 'monedero.vault.id',
} as const;

interface VaultMeta {
  saltHex: string;
  verifierHex: string;
  vaultId: string;
}

export class KeyVault implements KeyVaultPort {
  private meta: VaultMeta | null = null;
  private key: Uint8Array | null = null;

  constructor(private readonly storage: VaultStorage) {}

  async load(): Promise<void> {
    const [saltHex, verifierHex, vaultId] = await Promise.all([
      this.storage.getItem(KEYS.salt),
      this.storage.getItem(KEYS.verifier),
      this.storage.getItem(KEYS.id),
    ]);
    this.meta = saltHex && verifierHex && vaultId ? { saltHex, verifierHex, vaultId } : null;
  }

  hasVault(): boolean {
    return this.meta !== null;
  }

  async createVault(vaultId: string, passphrase: string): Promise<void> {
    if (passphrase.length < MIN_LEN) throw new DomainError('VALIDATION_FAILED', 'passphrase');
    if (this.meta) {
      if (this.meta.vaultId === vaultId) return; // idempotente por vaultId
      throw new DomainError('VAULT_ALREADY_EXISTS');
    }
    const { key, salt } = await createVaultKey(passphrase);
    const verifier = await encrypt(KNOWN, key);
    const meta: VaultMeta = { saltHex: bytesToHex(salt), verifierHex: bytesToHex(verifier), vaultId };
    await Promise.all([
      this.storage.setItem(KEYS.salt, meta.saltHex),
      this.storage.setItem(KEYS.verifier, meta.verifierHex),
      this.storage.setItem(KEYS.id, meta.vaultId),
    ]);
    this.meta = meta;
    this.key = key; // queda desbloqueada al crear (espejo PWA: status unlocked)
  }

  async unlock(passphrase: string): Promise<void> {
    if (!this.meta) throw new DomainError('VALIDATION_FAILED', 'vault');
    try {
      const key = await deriveKey(passphrase, hexToBytes(this.meta.saltHex));
      const plain = await decrypt(hexToBytes(this.meta.verifierHex), key);
      if (bytesToHex(plain) !== bytesToHex(KNOWN)) throw new DomainError('VAULT_WRONG_PASSPHRASE');
      this.key = key;
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new DomainError('VAULT_WRONG_PASSPHRASE'); // GCM auth fail
    }
  }

  lock(): void {
    this.key?.fill(0); // zeroize de la clave en memoria
    this.key = null;
  }

  isUnlocked(): boolean {
    return this.key !== null;
  }

  /**
   * Snapshot local cifrado (persistencia interina ADR-003): la clave maestra
   * NO sale de la bóveda; los bytes se sellan aquí con AES-256-GCM/IV aleatorio.
   */
  async encryptBytes(data: Uint8Array): Promise<Uint8Array> {
    if (!this.key) throw new DomainError('VALIDATION_FAILED', 'vault');
    return encrypt(data, this.key);
  }

  async decryptBytes(payload: Uint8Array): Promise<Uint8Array> {
    if (!this.key) throw new DomainError('VALIDATION_FAILED', 'vault');
    return decrypt(payload, this.key);
  }

  /** Borrado total (HU-19/F6): metadatos fuera + clave a ceros. */
  async delete(): Promise<void> {
    this.lock();
    await Promise.all([
      this.storage.removeItem(KEYS.salt),
      this.storage.removeItem(KEYS.verifier),
      this.storage.removeItem(KEYS.id),
    ]);
    this.meta = null;
  }
}
