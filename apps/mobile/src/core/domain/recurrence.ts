/**
 * Recurrence — dominio móvil (movimientos recurrentes: gastos/ingresos fijos).
 * Modelo mental: la app PROPONE cada mes y el usuario CONFIRMA la generación
 * (nunca crea transacciones sola — money-critical). Día 1..28 (mes seguro) ·
 * `lastGeneratedPeriod` (YYYY-MM) es el ancla de idempotencia: jamás se
 * genera dos veces el mismo periodo. Solo expense/income (sin transferencias).
 * El importe vive en CENTAVOS enteros (SSOT de dinero).
 */
import { z } from 'zod';

export type RecurrenceType = 'expense' | 'income';

export interface Recurrence {
  id: string;
  type: RecurrenceType;
  amountCents: number;
  currency: string;
  accountId: string;
  categoryId: string | null;
  payee: string | null;
  note: string | null;
  /** Día objetivo del mes (1..28). */
  dayOfMonth: number;
  /** Pausada = no se propone, pero conserva el historial. */
  active: boolean;
  /** Último periodo generado (YYYY-MM) o null si nunca. */
  lastGeneratedPeriod: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RecurrenceInput {
  type: RecurrenceType;
  amountCents: number;
  currency: string;
  accountId: string;
  categoryId?: string | null;
  payee?: string;
  note?: string;
  dayOfMonth: number;
}

export const RecurrenceInputSchema = z.object({
  type: z.enum(['expense', 'income']),
  amountCents: z
    .number()
    .int('MONEY_NOT_INTEGER')
    .refine((v) => v > 0, { message: 'VALIDATION_FAILED' }),
  currency: z.string().length(3),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable().optional(),
  payee: z.string().max(120).optional(),
  note: z.string().max(1000).optional(),
  dayOfMonth: z.number().int().min(1).max(28, 'VALIDATION_FAILED'),
});

/**
 * ¿Pendiente de proponer en `period`? Solo se propone cuando el día objetivo
 * ya llegó en el mes en curso (nada de gastos «a futuro»); meses pasados no
 * se rellenan solos (propone, no inventa).
 */
export function isPendingFor(rec: Recurrence, period: string, today: string): boolean {
  if (!rec.active || rec.deletedAt) return false;
  if (rec.lastGeneratedPeriod === period) return false;
  const currentPeriod = today.slice(0, 7);
  if (period !== currentPeriod) return false;
  const todayDay = Number(today.slice(8, 10));
  return todayDay >= rec.dayOfMonth;
}

/**
 * Construye el movimiento a generar en `period` con fecha nunca futura:
 * día = min(dayOfMonth, hoy) — puntual si va tarde, hoy si se confirma pronto.
 */
export function buildGeneratedTxInput(
  rec: Recurrence,
  period: string,
  today: string,
): {
  type: RecurrenceType;
  amountCents: number;
  currency: string;
  date: string;
  accountId: string;
  categoryId?: string | null;
  payee?: string;
  note?: string;
} {
  const todayDay = Number(today.slice(8, 10));
  const day = Math.max(1, Math.min(rec.dayOfMonth, todayDay));
  return {
    type: rec.type,
    amountCents: rec.amountCents,
    currency: rec.currency,
    date: `${period}-${String(day).padStart(2, '0')}`,
    accountId: rec.accountId,
    categoryId: rec.categoryId,
    payee: rec.payee ?? undefined,
    note: rec.note ?? undefined,
  };
}
