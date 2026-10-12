/**
 * TxRow — fila de movimiento (manual SSOT §7.6).
 * a11y: label compuesto (concepto, categoría, importe con signo) — nunca solo color.
 */
export interface TxRowProps {
  icon: string;
  title: string;
  category: string;
  /** Importe ya formateado con signo (formatMoney) */
  amount: string;
  isIncome: boolean;
  ariaLabel: string;
  onOpen?: () => void;
}

export function TxRow({ icon, title, category, amount, isIncome, ariaLabel, onOpen }: TxRowProps) {
  return (
    <button type="button" className="ds-tx" aria-label={ariaLabel} onClick={onOpen}>
      <span className="ds-tx__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ds-tx__body">
        <span className="ds-tx__title">{title}</span>
        <span className="ds-tx__cat">{category}</span>
      </span>
      <span className={['ds-tx__amount', isIncome ? 'ds-tx__amount--income' : ''].filter(Boolean).join(' ')}>
        {amount}
      </span>
    </button>
  );
}
