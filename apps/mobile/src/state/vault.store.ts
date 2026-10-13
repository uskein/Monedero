/**
 * Vault store (Zustand móvil) — estados BP-01/BP-02. Espejo de la PWA.
 * Fuente: BLUEPRINTS BP-01/BP-02 · máquina no-vault → locked → unlocked.
 * A diferencia de la PWA (localStorage síncrono), el arranque es ASYNC porque
 * SecureStore lo es: boot() carga los metadatos en el KeyVault inyectado.
 * El almacenamiento se inyecta con configureVaultStorage() (SecureStore en
 * AppRoot, memoria en tests); sin configurar usa memoria (nunca crashea).
 */
import { create } from 'zustand';
import { DomainError } from '../core/errors';
import type { VaultStorage } from '../core/ports/VaultStorage';
import { KeyVault } from '../infrastructure/security/KeyVault';
import { createMemoryVaultStorage } from '../infrastructure/security/memoryStorage';
import { randomUUID } from '../infrastructure/security/random';

export type VaultStatus = 'boot' | 'no-vault' | 'locked' | 'unlocked';

interface VaultState {
  status: VaultStatus;
  /** uuid de la bóveda activa (HU-14: viaja en el fichero exportado). */
  vaultId: string | null;
  /** DomainErrorCode | null — messageKey i18n en UI (nunca crudo en prod) */
  error: string | null;
  busy: boolean;
  boot: () => Promise<void>;
  createVault: (passphrase: string, confirm: string) => Promise<boolean>;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  clearError: () => void;
}

const MIN_LEN = 8;
/**
 * Watchdog de arranque (Android 16/Keystore): si la lectura de SecureStore
 * no asienta en 8 s, se trata como «sin bóveda» (onboarding) en lugar de un
 * spinner eterno silencioso. Espeja la semántica de la PWA (mejor permitir
 * crear de nuevo que bloquear el arranque). Ver test/validación manual.
 */
const BOOT_TIMEOUT_MS = 8000;

let vault: KeyVault | null = null;

function getVault(): KeyVault {
  vault ??= new KeyVault(createMemoryVaultStorage());
  return vault;
}

/**
 * Inyecta el almacenamiento de la bóveda. Llamar en AppRoot ANTES de montar
 * VaultGate; en tests, con createMemoryVaultStorage() en beforeEach.
 * Resetea el estado a 'boot' para que el nuevo almacén vuelva a arrancar.
 */
export function configureVaultStorage(storage: VaultStorage): void {
  vault = new KeyVault(storage);
  useVaultStore.setState({ status: 'boot', error: null, busy: false });
}

/**
 * Puerto de la bóveda activa (para inyectar crypto al repo dev: snapshot
 * local cifrado ADR-003). Null si aún no se ha configurado.
 */
export function getVaultPort(): KeyVault | null {
  return vault;
}

export const useVaultStore = create<VaultState>((set) => ({
  status: 'boot',
  vaultId: null,
  error: null,
  busy: false,

  boot: async () => {
    try {
      const load = getVault().load();
      // Si gana el watchdog, una carga tardía no debe dejar un rechazo sin manejar.
      load.catch(() => undefined);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('BOOT_TIMEOUT')), BOOT_TIMEOUT_MS),
      );
      await Promise.race([load, timeout]);
      const status = getVault().hasVault() ? 'locked' : 'no-vault';
      if (__DEV__) console.warn(`[monedero] vault boot → ${status}`);
      set({ status, vaultId: getVault().getVaultId(), error: null });
    } catch {
      // Keychain ilegible o colgada (rarísimo): mejor permitir crear de nuevo
      // que quedarse en spinner eterno — espeja la semántica «no hay bóveda».
      if (__DEV__) console.warn('[monedero] vault boot → no-vault (fallo/timeout)');
      set({ status: 'no-vault', vaultId: null, error: 'STORAGE_UNAVAILABLE' });
    }
  },

  createVault: async (passphrase, confirm) => {
    set({ error: null, busy: true });
    if (passphrase.length < MIN_LEN || passphrase !== confirm) {
      set({ error: 'VALIDATION_FAILED', busy: false });
      return false;
    }
    try {
      await getVault().createVault(await randomUUID(), passphrase);
      set({ status: 'unlocked', vaultId: getVault().getVaultId(), busy: false });
      return true;
    } catch (err) {
      set({ error: err instanceof DomainError ? err.code : 'STORAGE_UNAVAILABLE', busy: false });
      return false;
    }
  },

  unlock: async (passphrase) => {
    set({ error: null, busy: true });
    if (!getVault().hasVault()) {
      set({ status: 'no-vault', busy: false });
      return false;
    }
    try {
      await getVault().unlock(passphrase);
      set({ status: 'unlocked', vaultId: getVault().getVaultId(), busy: false });
      return true;
    } catch {
      set({ error: 'VAULT_WRONG_PASSPHRASE', busy: false });
      return false;
    }
  },

  lock: () => {
    getVault().lock();
    set({ status: 'locked' });
  },

  clearError: () => set({ error: null }),
}));

/** Solo tests: estado a 'boot' entre casos (configureVaultStorage ya crea vault nuevo). */
export function resetVaultStore(): void {
  useVaultStore.setState({ status: 'boot', error: null, busy: false });
}
