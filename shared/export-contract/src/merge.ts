/**
 * Merge LWW (Last-Write-Wins) del import (S7 · HU-15) — puro y sin BD.
 * Trabaja sobre FILAS DE BD (snake_case, como las devuelve SELECT *):
 *  - colecciones con id + updated_at (ISO-8601, comparables léxicamente):
 *    gana el updated_at MAYOR; empate con contenido distinto → conflicto
 *    (se conserva el local y se contabiliza); sin id válido → descartado.
 *  - transaction_tags (PK compuesta, sin tiempo): unión de conjuntos.
 *  - Los tombstones (deleted_at) viajan y se respetan: un borrado más
 *    reciente también gana (permite sincronizar borrados entre plataformas).
 * El plan resultante se aplica en EXPORT_ORDER (FKs primero).
 */
import type { MonederoCollection, ImportSummary } from './types';
import { canonicalize } from './hash';
import { EXPORT_ORDER } from './file';

export type DbRow = Record<string, unknown>;

export interface MergePlan {
  /** Filas a INSERTAR, por colección, en orden de aplicación. */
  inserts: Array<{ collection: MonederoCollection; rows: DbRow[] }>;
  /** Filas a ACTUALIZAR (UPDATE completo por id). */
  updates: Array<{ collection: MonederoCollection; rows: DbRow[] }>;
  summary: ImportSummary;
}

const SET_UNION_COLLECTIONS = new Set<MonederoCollection>(['transaction_tags']);

function rowKey(collection: MonederoCollection, row: DbRow): string {
  if (collection === 'transaction_tags') {
    return `${String(row.transaction_id)}::${String(row.tag_id)}`;
  }
  return String(row.id ?? '');
}

const EMPTY_SUMMARY: ImportSummary = { added: 0, updated: 0, skipped: 0, conflicts: 0, reasons: {} };

function bump(summary: ImportSummary, reason: string): void {
  summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1;
}

/** Planifica el merge de `incoming` (fichero) contra `existing` (BD local). */
export function planMerge(
  incoming: Record<MonederoCollection, unknown[]>,
  existingByCollection: Record<MonederoCollection, DbRow[]>,
): MergePlan {
  const summary: ImportSummary = { ...EMPTY_SUMMARY, reasons: {} };
  const inserts: Array<{ collection: MonederoCollection; rows: DbRow[] }> = [];
  const updates: Array<{ collection: MonederoCollection; rows: DbRow[] }> = [];

  for (const collection of EXPORT_ORDER) {
    const incomingRows = (incoming[collection] ?? []) as DbRow[];
    const localRows = existingByCollection[collection] ?? [];
    const localByKey = new Map(localRows.map((row) => [rowKey(collection, row), row]));
    const insertRows: DbRow[] = [];
    const updateRows: DbRow[] = [];

    for (const row of incomingRows) {
      const key = rowKey(collection, row);
      if (key === '') {
        summary.skipped += 1;
        bump(summary, 'FILA_INVALIDA');
        continue;
      }
      const local = localByKey.get(key);

      if (SET_UNION_COLLECTIONS.has(collection)) {
        if (!local) {
          insertRows.push(row);
          summary.added += 1;
        } else {
          summary.skipped += 1;
          bump(summary, 'SIN_CAMBIOS');
        }
        continue;
      }

      if (!local) {
        insertRows.push(row);
        summary.added += 1;
        continue;
      }

      const incomingUpdated = String(row.updated_at ?? '');
      const localUpdated = String(local.updated_at ?? '');
      if (incomingUpdated > localUpdated) {
        updateRows.push(row);
        summary.updated += 1;
      } else if (incomingUpdated < localUpdated) {
        summary.skipped += 1;
        bump(summary, 'LOCAL_MAS_RECIENTE');
      } else if (canonicalize(row) !== canonicalize(local)) {
        // Empate con contenido distinto: gana el local (determinista) y se
        // contabiliza el conflicto para que la UI lo muestre.
        summary.conflicts += 1;
        bump(summary, 'CONFLICTO_EN_EMPATE');
      } else {
        summary.skipped += 1;
        bump(summary, 'SIN_CAMBIOS');
      }
    }

    if (insertRows.length > 0) inserts.push({ collection, rows: insertRows });
    if (updateRows.length > 0) updates.push({ collection, rows: updateRows });
  }

  return { inserts, updates, summary };
}

/** Plan de REEMPLAZAR (HU-16): vaciar todo y insertar el fichero tal cual. */
export function planReplace(
  incoming: Record<MonederoCollection, unknown[]>,
): Pick<MergePlan, 'inserts'> & { summary: ImportSummary } {
  const summary: ImportSummary = { ...EMPTY_SUMMARY, reasons: {} };
  const inserts: Array<{ collection: MonederoCollection; rows: DbRow[] }> = [];
  for (const collection of EXPORT_ORDER) {
    const rows = (incoming[collection] ?? []) as DbRow[];
    if (rows.length > 0) {
      inserts.push({ collection, rows });
      summary.added += rows.length;
    }
  }
  return { inserts, summary };
}
