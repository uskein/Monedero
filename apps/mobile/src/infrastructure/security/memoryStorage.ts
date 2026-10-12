/**
 * VaultStorage en memoria — tests y arranque sin configurar (inyección).
 */
import type { VaultStorage } from '../../core/ports/VaultStorage';

export function createMemoryVaultStorage(initial: Record<string, string> = {}): VaultStorage {
  const map = new Map(Object.entries(initial));
  return {
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}
