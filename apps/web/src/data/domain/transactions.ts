/**
 * Dominio Transaction (PWA) — tipos y esquema Zod.
 * Fuente SSOT: MODELO_DE_DATOS.md §3/§5 · CONTRATOS_API.md §1.1 (TxFilter, puerto).
 * Reglas: centavos enteros (nunca FLOAT) · transfer ⇔ to_account_id NOT NULL ·
 * transfer sin categoría · fecha YYYY-MM-DD · tombstones (deleted_at) exportables.
 */
import { z } from 'zod';

export type TxType = 'income' | 'expense' | 'transfer';
export type TxStatus = 'pending' | 'cleared';

export interface Transaction {
  id: string;
  type: TxType;
  amountCents: number;
  currency: string;
  /** Día calendario local YYYY-MM-DD (no hora; TZ solo al exportar). */
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  payee: string | null;
  note: string | null;
  status: TxStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TxFilter {
  month?: string; // 'YYYY-MM'
  accountId?: string;
  categoryId?: string;
  type?: TxType;
  search?: string; // payee/note, saneado ≤120
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Objeto base (sin refinamientos) — el patch se deriva de aquí con .partial(). */
const TxBaseObject = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amountCents: z
    .number()
    .int('MONEY_NOT_INTEGER')
    .min(0)
    // HU-05: importe 0 → VALIDATION_FAILED field:amount (nunca registrar $0).
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

/** Schema de alta (BP-05): valida ANTES de persistir (CONTRATOS_API §1.4). */
export const TxInputSchema = TxBaseObject.superRefine((value, ctx) => {
    // CHECK ((type='transfer') = (to_account_id IS NOT NULL))
    if (value.type === 'transfer' && !value.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'INTEGRITY_VIOLATION',
      });
    }
    if (value.type !== 'transfer' && value.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'INTEGRITY_VIOLATION',
      });
    }
    // CHECK (type <> 'transfer' OR category_id IS NULL)
    if (value.type === 'transfer' && value.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'INTEGRITY_VIOLATION',
      });
    }
    // CHECK (account_id <> to_account_id)
    if (value.type === 'transfer' && value.toAccountId === value.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toAccountId'],
        message: 'INTEGRITY_VIOLATION',
      });
    }
  });

export type TxInput = z.input<typeof TxInputSchema>;

/** Patch de actualización: campos opcionales; nunca cambia id/createdAt. */
export const TxPatchSchema = TxBaseObject.partial().omit({ status: true }).extend({
  status: z.enum(['pending', 'cleared']).optional(),
});
export type TxPatch = z.input<typeof TxPatchSchema>;

/** Sanea la búsqueda (CONTRATOS_API: ≤120, sin SQL). */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_\\]/g, ' ').trim().slice(0, 120);
}
