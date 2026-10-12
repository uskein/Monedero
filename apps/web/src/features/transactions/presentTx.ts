/**
 * Presentación de movimientos — iconos, etiquetas de tipo y vista de fila.
 * Compartido por TransactionList (BP-04) y DashboardScreen (BP-03 · últimos
 * movimientos) para que iconos/categorías/aria-label no diverjan (SSOT).
 */
import type { TFunction, CurrencyCode } from '@monedero/i18n';
import type { Transaction, TxType } from '../../data/domain/transactions';

/** Icono por tipo (mismo set que el seed; texto plano por a11y). */
export function categoryIcon(type: TxType): string {
  if (type === 'income') return '↑';
  if (type === 'transfer') return '⇄';
  return '↓';
}

/** Mapa explícito (nunca claves dinámicas: TranslationKey es unión cerrada). */
export const TYPE_LABEL_KEY = {
  income: 'tx.type.income',
  expense: 'tx.type.expense',
  transfer: 'tx.type.transfer',
} as const;

/** Props listas para <TxRow />. */
export interface TxRowView {
  icon: string;
  title: string;
  category: string;
  /** Importe ya formateado con signo (formatMoney). */
  amount: string;
  isIncome: boolean;
  ariaLabel: string;
}

export function txRowView(
  tx: Transaction,
  opts: {
    t: TFunction;
    currency: CurrencyCode;
    moneySigned: (cents: number, currency: CurrencyCode, isIncome: boolean) => string;
    categoryNames: Record<string, string>;
  },
): TxRowView {
  const { t, currency, moneySigned, categoryNames } = opts;
  const title = tx.payee ?? t('tx.form.payee');
  const amount = moneySigned(tx.amountCents, currency, tx.type === 'income');
  return {
    icon: categoryIcon(tx.type),
    title,
    category: tx.categoryId
      ? (categoryNames[tx.categoryId] ?? tx.categoryId)
      : t(TYPE_LABEL_KEY[tx.type]),
    amount,
    isIncome: tx.type === 'income',
    ariaLabel: `${title} — ${amount}`,
  };
}
