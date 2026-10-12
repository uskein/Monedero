/**
 * Aleatoriedad segura (ADR-003) en todas las plataformas.
 * Node (tests) y navegadores exponen globalThis.crypto; en Hermes (Expo) se
 * cae a expo-crypto vía import dinámico — los tests de nodo nunca lo cargan.
 */

interface WebCryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID?(): string;
}

export async function randomBytes(length: number): Promise<Uint8Array> {
  const web = (globalThis as { crypto?: WebCryptoLike }).crypto;
  if (web?.getRandomValues) return web.getRandomValues(new Uint8Array(length));
  const { getRandomBytes } = await import('expo-crypto');
  return getRandomBytes(length);
}

export async function randomUUID(): Promise<string> {
  const web = (globalThis as { crypto?: WebCryptoLike }).crypto;
  if (web?.randomUUID) return web.randomUUID();
  const { randomUUID: expoRandomUUID } = await import('expo-crypto');
  return expoRandomUUID();
}
