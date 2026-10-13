/**
 * KeyVaultPort — puerto de bóveda (CONTRATOS_API.md).
 * core NO importa react-native: la implementación (SecureStore / WebCrypto)
 * vive en infrastructure/ y se inyecta en AppRoot.
 */
export interface KeyVaultPort {
  /**
   * Lee los metadatos de la bóveda desde el almacenamiento (SecureStore es
   * async). Debe llamarse antes de hasVault()/unlock() — el propio boot del
   * store lo hace.
   */
  load(): Promise<void>;
  /** Deriva y guarda la clave maestra a partir de la passphrase. Idempotente por vaultId. */
  createVault(vaultId: string, passphrase: string): Promise<void>;
  /** Desbloquea: deriva y cachea la clave en memoria. Lanza DomainError si no coincide. */
  unlock(passphrase: string): Promise<void>;
  /** Bloquea y hace zeroize de la clave en memoria. */
  lock(): void;
  isUnlocked(): boolean;
  /** ¿Existe ya una bóveda creada en este dispositivo? (requiere load() previo) */
  hasVault(): boolean;
  /**
   * Cifra bytes con la clave maestra (AES-256-GCM, IV aleatorio) — la clave
   * NUNCA sale de la bóveda (ADR-003: snapshot de la BD local en RamFs).
   * Requiere desbloqueado; lanza en caso contrario.
   */
  encryptBytes(data: Uint8Array): Promise<Uint8Array>;
  /** Descifra bytes (GCM autentica: clave incorrecta o corrupción → lanza). */
  decryptBytes(payload: Uint8Array): Promise<Uint8Array>;
  /** BORRADO TOTAL de la bóveda (HU-19/F6): metadatos del almacenamiento
   *  fuera + zeroize de la clave en memoria. */
  delete(): Promise<void>;
}
