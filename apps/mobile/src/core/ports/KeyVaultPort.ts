/**
 * KeyVaultPort — puerto de bóveda (CONTRATOS_API.md).
 * core NO importa react-native: la implementación (SecureStore / WebCrypto)
 * vive en infrastructure/ y se inyecta en AppRoot.
 */
export interface KeyVaultPort {
  /** Deriva y guarda la clave maestra a partir de la passphrase. Idempotente por vaultId. */
  createVault(vaultId: string, passphrase: string): Promise<void>;
  /** Desbloquea: deriva y cachea la clave en memoria. Lanza DomainError si no coincide. */
  unlock(passphrase: string): Promise<void>;
  /** Bloquea y hace zeroize de la clave en memoria. */
  lock(): void;
  isUnlocked(): boolean;
  /** ¿Existe ya una bóveda creada en este dispositivo? */
  hasVault(): boolean;
}
