/**
 * uuid v4 sin dependencias + traductor de UNIQUE — repos sql.js (PWA).
 * crypto.randomUUID con fallback Math.random (identificadores locales de fila).
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Traduce la violación UNIQUE de SQLite a INTEGRITY_VIOLATION de dominio. */
export function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('UNIQUE constraint failed');
}
