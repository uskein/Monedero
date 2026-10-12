/**
 * VaultStorage — almacenamiento clave-valor de la bóveda móvil.
 * Implementaciones: expo-secure-store (Keychain/Keystore) en el dispositivo,
 * memoria en tests. core es TS puro: NO importa expo ni react-native.
 */
export interface VaultStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
