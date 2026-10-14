/**
 * Puerto RecurrenceRepository — movimientos recurrentes (HU nuevo · v0.3.0).
 * Idempotencia: `markGenerated(id, period)` es el único camino que ancla un
 * periodo; la generación de la transacción la orquesta el store (no el repo).
 */
import type { Recurrence, RecurrenceInput } from '../domain/recurrence';

export type Unsubscribe = () => void;

export type RecurrenceEvent = {
  scope: 'recurrence';
  type: 'recurrence:changed';
  id: string;
};

export type RecurrencePatch = Partial<{
  amountCents: number;
  categoryId: string | null;
  accountId: string;
  payee: string;
  note: string;
  dayOfMonth: number;
  active: boolean;
}>;

export interface RecurrenceRepository {
  /** Activas y pausadas (sin tombstones), orden por día y hora de creación. */
  list(): Promise<Recurrence[]>;
  create(input: RecurrenceInput): Promise<Recurrence>;
  update(id: string, patch: RecurrencePatch): Promise<Recurrence>;
  /** Borrado lógico (tombstone) — los movimientos generados NO se tocan. */
  remove(id: string): Promise<void>;
  /** Ancla idempotente: marca el periodo como generado para esta regla. */
  markGenerated(id: string, period: string): Promise<void>;
  subscribe(cb: (e: RecurrenceEvent) => void): Unsubscribe;
}
