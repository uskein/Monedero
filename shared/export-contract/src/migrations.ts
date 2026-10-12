/**
 * Migraciones forward-only de versión de formato (v0.x → v1).
 * Fuente: CONTRATOS_API.md §migraciones — nada de rollback: el import es fusionado tras validar.
 * NOTA: fixtures de matriz (v1/corrupto/futuro/hash alterado) en S2.
 */
import { FORMAT_VERSION } from './types';

export type FormatVersion = number;

/** Devuelve el fichero migrado a FORMAT_VERSION. Lanza si la versión es futura. */
export function migrate(file: { formatVersion: number }): { formatVersion: number } {
  if (file.formatVersion > FORMAT_VERSION) {
    throw new Error('VERSION_NO_SOPORTADA');
  }
  // v0.x (beta interna) → v1: solo se reetiqueta; las colecciones eran idénticas.
  return { ...file, formatVersion: FORMAT_VERSION };
}
