/**
 * JSON canónico → base para integridad SHA-256.
 * Regla: claves ordenadas alfabéticamente, sin dependencia del orden de escritura.
 * Fuente: CONTRATOS_API.md §integridad
 * NOTA: cálculo SHA-256 síncrono/asíncrono por plataforma se añade en S2 (tarea 2.2).
 */

/** Serializa con claves ordenadas de forma determinista. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}
