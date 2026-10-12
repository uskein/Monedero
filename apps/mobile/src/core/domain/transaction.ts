/**
 * Transaction — dominio móvil (espejo de la PWA, HU-05·06·07).
 * Fuente: MODELO_DE_DATOS.md §3/§5. Los schemas Zod replican los CHECKs del
 * esquema SQL para rechazar inválidos ANTES de persistir (CONTRATOS_API §1.4).
 * TDD estricto: dinero/transferencias son área crítica.
 *
 * Nota de diseño: este schema espeja los CHECKs viven en shared/db (SSOT del DDL).
 * Se duplica aquí a propósito en S3; extraerlo a un shared/domain es el camino a
 * eliminar el drift una vez ambas apps consoliden el dominio.
 */
import { z } from 'zod';

export type TxType = 'income' | 'expense' | 'transfer';
export type TxStatus = 'pending' | 'cleared';

export interface Transaction {
  id: string;
  type: TxType;
  amountCents: number;
  currency: string;
  /** YYYY-MM-DD (CHECK GLOB en BD). */
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  payee: string | null;
  note: string | null;
  status: TxStatus;
  createdAt: string;
  updatedAt: string;
  /** Tombstone: no se borra la fila; se marca para propagar por export. */
  deletedAt: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Objeto base (sin refinamientos) — el patch se deriva con .partial(). */
const TxBaseObject = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amountCents: z
    .number()
    .int('MONEY_NOT_INTEGER')
    .min(0)
    // HU-05: importe 0 → VALIDATION_FAILED (nunca registrar $0).
    .refine((v) => v > 0, { message: 'VALIDATION_FAILED' }),
  currency: z.string().length(3),
  date: z.string().regex(ISO_DATE, 'VALIDATION_FAILED'),
  accountId: z.string().min(1),
  toAccountId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  payee: z.string().max(120).optional(),
  note: z.string().max(1000).optional(),
  status: z.enum(['pending', 'cleared']).default('cleared'),
});

/** Schema de alta (BP-05): valida reglas de transferencia (CHECKs del modelo). */
export const TxInputSchema = TxBaseObject.superRefine((value, ctx) => {
  // CHECK ((type='transfer') = (to_account_id IS NOT NULL))
  if (value.type === 'transfer' && !value.toAccountId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toAccountId'], message: 'INTEGRITY_VIOLATION' });
  }
  if (value.type !== 'transfer' && value.toAccountId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toAccountId'], message: 'INTEGRITY_VIOLATION' });
  }
  // CHECK transfer ⇒ category_id NULL
  if (value.type === 'transfer' && value.categoryId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryId'], message: 'INTEGRITY_VIOLATION' });
  }
  // CHECK (account_id <> to_account_id)
  if (value.type === 'transfer' && value.toAccountId === value.accountId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toAccountId'], message: 'INTEGRITY_VIOLATION' });
  }
});

export type TxInput = z.input<typeof TxInputSchema>;

/** Patch de actualización: campos opcionales; nunca cambia id/createdAt. */
export const TxPatchSchema = TxBaseObject.partial().omit({ status: true }).extend({
  status: z.enum(['pending', 'cleared']).optional(),
});
export type TxPatch = z.input<typeof TxPatchSchema>;

/** Filtro de listado (BP-04). */
export interface TxFilter {
  month?: string; // YYYY-MM
  type?: TxType;
  accountId?: string;
  categoryId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** Resumen BP-03 (HU-08·09): saldo total global + reporte del mes. */
export interface DashboardSummary {
  /** Σ iniciales de cuentas + ingresos − gastos (GLOBAL: no depende del mes). */
  totalBalanceCents: number;
  /** Ingresos del mes pedido. */
  incomeCents: number;
  /** Gastos del mes pedido. */
  expenseCents: number;
  /** ingresos − gastos del mes pedido. */
  monthBalanceCents: number;
}

/** Sanea la búsqueda (CONTRATOS_API: ≤120, sin comodines LIKE). */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_\\]/g, ' ').trim().slice(0, 120);
}
