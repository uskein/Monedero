/**
 * MoneyInput — campo monetario Clay (manual SSOT §7.4).
 * Prefijo de moneda + tabular-nums + inputmode decimal.
 * El prefijo/locale lo decide el caller con formatMoney (i18n módulo compartido).
 */
import { useId } from 'react';

export interface MoneyInputProps {
  label: string;
  /** Símbolo visible, ej. "$", "€", "US$" — lo calcula el caller por moneda de la cuenta. */
  currencySymbol: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function MoneyInput({ label, currencySymbol, value, onValueChange, error, disabled }: MoneyInputProps) {
  const base = useId();
  const inputId = `${base}-money`;
  const errorId = `${base}-money-error`;
  const invalid = Boolean(error);

  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="ds-money">
        <span className="ds-money__prefix" aria-hidden="true">
          {currencySymbol}
        </span>
        <input
          id={inputId}
          className="ds-money__input"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(e) => onValueChange(e.target.value.replace(',', '.'))}
        />
      </div>
      {invalid && (
        <p className="ds-hint" id={errorId} role="alert">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}
    </div>
  );
}
