/**
 * SnapshotStorage — puerto de almacenamiento del snapshot cifrado de la BD
 * (persistencia interina ADR-003, mientras llega SQLCipher en el dev-build).
 * Implementación de prod: archivo en el directorio de documentos de la app vía
 * expo-file-system (Expo Go compatible). La encriptación NO vive aquí: el blob
 * llega ya cifrado con la clave de bóveda (KeyVaultPort.encryptBytes).
 * El import de expo-file-system es DINÁMICO: en jest nunca se carga.
 */
export interface SnapshotStorage {
  /** Devuelve el blob o null si no existe / hay cualquier problema de lectura. */
  read(): Promise<Uint8Array | null>;
  /** Escribe/reescribe el snapshot. */
  write(bytes: Uint8Array): Promise<void>;
  /** Elimina el snapshot si existe (best-effort). */
  clear(): Promise<void>;
}

const FILE_NAME = 'monedero-snapshot.db.aes';

/** Memoria (tests + fallback «sin disco»): nunca toca nativos. */
export function createMemorySnapshotStorage(): SnapshotStorage & { data: Uint8Array | null } {
  const store: { data: Uint8Array | null } = { data: null };
  return {
    get data() {
      return store.data;
    },
    async read() {
      return store.data;
    },
    async write(bytes) {
      store.data = bytes;
    },
    async clear() {
      store.data = null;
    },
  };
}

/** Prod: archivo cifrado en el sandbox de la app (FileSystem.document). */
export function createFileSystemSnapshotStorage(): SnapshotStorage {
  async function file() {
    const { File, Paths } = await import('expo-file-system');
    return new File(Paths.document, FILE_NAME);
  }
  return {
    async read() {
      try {
        const f = await file();
        if (!f.exists) return null;
        return await f.bytes();
      } catch {
        return null; // lectura ilegible → se trata como «sin snapshot»
      }
    },
    async write(bytes) {
      const f = await file();
      f.write(bytes); // síncrono en la API de SDK 57
    },
    async clear() {
      try {
        const f = await file();
        if (f.exists) f.delete();
      } catch {
        // best-effort: el peor caso es un snapshot viejo que luego fallará
        // el GCM y se descartará en el arranque.
      }
    },
  };
}
