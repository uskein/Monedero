/**
 * uuid v4 sin dependencias — repositorios sobre SqlDbPort.
 * crypto.randomUUID (Node 19+/Hermes con polyfill) con fallback Math.random
 * (no criptográfico, pero suficiente para identificadores locales de fila).
 */
export function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const c = g.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c0) => {
    const r = (Math.random() * 16) | 0;
    const v = c0 === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Traduce la violación UNIQUE de SQLite a INTEGRITY_VIOLATION de dominio. */
export function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('UNIQUE constraint failed');
}
