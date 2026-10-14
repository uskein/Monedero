/**
 * Biometric unlock (v0.3.0) — desbloqueo con huella/rostro.
 *
 * Semántica de seguridad (ADR-003 intacta): la huella NO sustituye a la
 * clave de bóveda. Solo REVELA la passphrase guardada en SecureStore
 * (cifrada por el keystore del sistema) para que la app ejecute el MISMO
 * desbloqueo (KDF → clave de snapshot). Nunca deriva ni guarda la clave.
 *
 * Guardas:
 *  - `expo-local-authentication` y `expo-secure-store` se importan de forma
 *    DINÁMICA dentro de funciones: en jest jamás se cargan (mismo patrón
 *    que prefs.store / vault.store), y los errores nativos se traducen a
 *    `false`/`null` para degradar a escribir la contraseña.
 *  - Solo se ofrece si hay hardware Y biometría ENROLADA en el dispositivo.
 *  - Si el usuario cambia sus huellas, la passphrase en SecureStore se
 *    invalida → la app la descarta y vuelve a pedir la contraseña.
 */

const KEY_PASSPHRASE = 'monedero.bio.passphrase';
const KEY_DECLINED = 'monedero.bio.declined';

/** Superficies mínimas de los módulos nativos (import dinámico + cast). */
interface LocalAuthLike {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  authenticateAsync(options: { promptMessage: string }): Promise<{ success: boolean }>;
}

interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

async function loadLocalAuth(): Promise<LocalAuthLike | null> {
  try {
    return ((await import('expo-local-authentication')) as { default: LocalAuthLike }).default;
  } catch {
    return null;
  }
}

async function loadSecureStore(): Promise<SecureStoreLike | null> {
  try {
    return ((await import('expo-secure-store')) as { default: SecureStoreLike }).default;
  } catch {
    return null;
  }
}

/**
 * ¿Puede usarse la huella? True solo si hay hardware Y biometría enrolada.
 * Cualquier fallo (módulo ausente en jest/Expo Go sin módulo, error nativo)
 * devuelve false → la UI no pinta nada y se usa la contraseña.
 */
export async function biometricAvailable(): Promise<boolean> {
  const auth = await loadLocalAuth();
  if (!auth) return false;
  try {
    const hasHardware = await auth.hasHardwareAsync();
    if (!hasHardware) return false;
    return await auth.isEnrolledAsync();
  } catch {
    return false;
  }
}

/** ¿Está activado el desbloqueo con huella (hay passphrase guardada)? */
export async function biometricEnabled(): Promise<boolean> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return false;
  try {
    return (await SecureStore.getItemAsync(KEY_PASSPHRASE)) != null;
  } catch {
    return false;
  }
}

/** ¿Rechazó el usuario la oferta? (para no insistir en cada arranque). */
export async function biometricDeclined(): Promise<boolean> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return false;
  try {
    return (await SecureStore.getItemAsync(KEY_DECLINED)) != null;
  } catch {
    return false;
  }
}

export async function setBiometricDeclined(): Promise<void> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return;
  try {
    await SecureStore.setItemAsync(KEY_DECLINED, '1');
  } catch {
    /* best-effort */
  }
}

/** Reabre la oferta (desde Ajustes, si antes la rechazó). */
export async function clearBiometricDecline(): Promise<void> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(KEY_DECLINED);
  } catch {
    /* best-effort */
  }
}

/**
 * Guarda la passphrase para revelarla con biometría (tras un desbloqueo
 * válido). El guardado exige confirmación biométrica para que nadie más
 * con el dispositivo activado pueda habilitarlo sin demostrar identidad.
 * `promptMessage` llega ya traducida desde la UI (texto visible en el SO).
 */
export async function enableBiometric(passphrase: string, promptMessage: string): Promise<boolean> {
  const auth = await loadLocalAuth();
  const SecureStore = await loadSecureStore();
  if (!auth || !SecureStore) return false;
  try {
    const result = await auth.authenticateAsync({ promptMessage });
    if (!result.success) return false;
    await SecureStore.setItemAsync(KEY_PASSPHRASE, passphrase);
    await SecureStore.deleteItemAsync(KEY_DECLINED);
    return true;
  } catch {
    return false;
  }
}

/** Desactiva el desbloqueo con huella (borra la passphrase guardada). */
export async function disableBiometric(): Promise<void> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(KEY_PASSPHRASE);
  } catch {
    /* best-effort */
  }
}

/**
 * Pide la huella y devuelve la passphrase para correr el desbloqueo normal.
 * Devuelve null si se cancela, falla o la passphrase guardada ya no sirve
 * (huellas cambiadas) — en ese caso se limpia para no reintentar en vano.
 */
export async function passphraseFromBiometric(promptMessage: string): Promise<string | null> {
  const auth = await loadLocalAuth();
  const SecureStore = await loadSecureStore();
  if (!auth || !SecureStore) return null;
  try {
    const result = await auth.authenticateAsync({ promptMessage });
    if (!result.success) return null;
    const stored = await SecureStore.getItemAsync(KEY_PASSPHRASE);
    if (stored == null) return null;
    return stored;
  } catch {
    return null;
  }
}
