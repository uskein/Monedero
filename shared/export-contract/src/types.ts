/**
 * Tipos del fichero .monedero — contrato v1 (ADR-002: único acoplamiento móvil ⇄ PWA).
 * Fuente: Artefactos/documentacion/Arquitectura/CONTRATOS_API.md
 * NOTA: implementación completa con TDD en Sprint S2 (tarea 2.2).
 */

/** Versión de formato soportada por este contrato. */
export const FORMAT_VERSION = 1 as const;

/** Colecciones exportables (8 tablas; import_log es local y NO se exporta). */
export type MonederoCollection =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'tags'
  | 'transaction_tags'
  | 'budgets'
  | 'settings';

export interface MonederoFile {
  formatVersion: typeof FORMAT_VERSION;
  /** ISO-8601 UTC */
  exportedAt: string;
  /** uuid v4 de la bóveda de origen */
  vaultId: string;
  /** Moneda base de la bóveda (ISO-4217) */
  currency: string;
  /** Hash SHA-256 (hex) del JSON canónico con la colección `integrity` */
  integrity: { sha256: string };
  data: Record<MonederoCollection, unknown[]>;
}

/** Resultado del import: siempre en español (UI lo localiza por messageKey). */
export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  conflicts: number;
  /** Razones agrupadas, ej. 'SIN_CAMBIOS' | 'VERSION_NO_SOPORTADA' */
  reasons: Record<string, number>;
}
