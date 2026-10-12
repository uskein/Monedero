/**
 * VaultStorage producción — Keychain (iOS) / Keystore (Android) vía expo-secure-store.
 * Se inyecta en AppRoot; los tests usan memoria (createMemoryVaultStorage).
 */
import * as SecureStore from 'expo-secure-store';
import type { VaultStorage } from '../../core/ports/VaultStorage';

export function createSecureStoreStorage(): VaultStorage {
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}
