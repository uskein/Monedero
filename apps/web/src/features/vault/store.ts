/**
 * Vault store (Zustand) — estados de la bóveda según BP-01/BP-02.
 * Fuente: BLUEPRINTS_DE_PANTALLAS.md · Máquina: no-vault → locked → unlocked.
 * Verificación de passphrase: verificador AES-GCM (PBKDF2 NO falla con passphrase
 * equivocada, deriva otra clave; por eso se descifra un known-answer almacenado).
 */
import { create } from 'zustand';
import { createVaultKey, deriveKey } from '../../data/crypto/kdf';
import { decrypt, encrypt } from '../../data/crypto/aesGcm';

export type VaultStatus = 'boot' | 'no-vault' | 'locked' | 'unlocked';

interface VaultState {
  status: VaultStatus;
  saltHex: string | null;
  /** known-answer cifrado (hex) que solo descifra la passphrase correcta */
  verifierHex: string | null;
  vaultId: string | null;
  /** DomainErrorCode | null — messageKey i18n en UI (nunca crudo en prod) */
  error: string | null;
  busy: boolean;
  boot: () => void;
  createVault: (passphrase: string, confirm: string) => Promise<boolean>;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  clearError: () => void;
}

const LS = {
  salt: 'monedero.vault.salt',
  verifier: 'monedero.vault.verifier',
  id: 'monedero.vault.id',
  session: 'monedero.vault.session',
} as const;

const MIN_LEN = 8;
const KNOWN = new TextEncoder().encode('monedero-vault-ok-v1');

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'boot',
  saltHex: null,
  verifierHex: null,
  vaultId: null,
  error: null,
  busy: false,

  boot: () => {
    const saltHex = localStorage.getItem(LS.salt);
    const verifierHex = localStorage.getItem(LS.verifier);
    const vaultId = localStorage.getItem(LS.id);
    set({
      status: saltHex ? 'locked' : 'no-vault',
      saltHex,
      verifierHex,
      vaultId,
    });
  },

  createVault: async (passphrase, confirm) => {
    set({ error: null, busy: true });
    if (passphrase.length < MIN_LEN || passphrase !== confirm) {
      set({ error: 'VALIDATION_FAILED', busy: false });
      return false;
    }
    const { key, salt } = await createVaultKey(passphrase);
    const verifier = await encrypt(KNOWN, key);
    localStorage.setItem(LS.salt, bytesToHex(salt));
    localStorage.setItem(LS.verifier, bytesToHex(verifier));
    const vaultId = crypto.randomUUID();
    localStorage.setItem(LS.id, vaultId);
    sessionStorage.setItem(LS.session, '1');
    set({ status: 'unlocked', saltHex: bytesToHex(salt), verifierHex: bytesToHex(verifier), vaultId, busy: false });
    return true;
  },

  unlock: async (passphrase) => {
    set({ error: null, busy: true });
    const { saltHex, verifierHex } = get();
    if (!saltHex || !verifierHex) {
      set({ status: 'no-vault', busy: false });
      return false;
    }
    try {
      const key = await deriveKey(passphrase, hexToBytes(saltHex));
      const plain = await decrypt(hexToBytes(verifierHex), key);
      if (bytesToHex(plain) !== bytesToHex(KNOWN)) throw new Error('MISMATCH');
      sessionStorage.setItem(LS.session, '1');
      set({ status: 'unlocked', busy: false });
      return true;
    } catch {
      set({ error: 'VAULT_WRONG_PASSPHRASE', busy: false });
      return false;
    }
  },

  lock: () => {
    sessionStorage.removeItem(LS.session);
    set({ status: 'locked' });
  },

  clearError: () => set({ error: null }),
}));
