/**
 * Zod schemas del fichero .monedero.
 * Fuente: CONTRATOS_API.md — validación en import: Zod → hash → decrypt.
 * NOTA: schemas completos de colecciones con TDD en S2 (tarea 2.2); scaffold compilable aquí.
 */
import { z } from 'zod';
import { FORMAT_VERSION } from './types';

/** Envoltorio mínimo validable; se extiende por colección en S2. */
export const MonederoFileSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  vaultId: z.string().uuid(),
  currency: z.string().length(3),
  integrity: z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/) }),
  data: z.record(z.string(), z.array(z.unknown())),
});

export type MonederoFileInput = z.input<typeof MonederoFileSchema>;
