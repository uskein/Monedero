/**
 * VaultStorage producción — Keychain (iOS) / Keystore (Android) vía expo-secure-store.
 * Se inyecta en AppRoot; los tests usan memoria (createMemoryVaultStorage).
 * Import DINÁMICO (mismo criterio que random.ts): el módulo nativo solo se
 * carga cuando se usa de verdad — en jest nunca se ejecuta, así que no hace
 * falta mockear expo-secure-store.
 */
import type { VaultStorage } from '../../core/ports/VaultStorage';

export function createSecureStoreStorage(): VaultStorage {
  return {
    getItem: async (key) => (await import('expo-secure-store')).getItemAsync(key),
    setItem: async (key, value) => (await import('expo-secure-store')).setItemAsync(key, value),
    removeItem: async (key) => (await import('expo-secure-store')).deleteItemAsync(key),
  };
}
