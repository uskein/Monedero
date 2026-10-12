/**
 * Field + Input — formulario Clay (manual SSOT §7.4).
 * Reglas a11y: label SIEMPRE visible (nunca placeholder como única etiqueta);
 * error asociado vía aria-describedby + aria-describedby en money.
 */
import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (ids: { inputId: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  const base = useId();
  const inputId = `${base}-input`;
  const errorId = `${base}-error`;
  const invalid = Boolean(error);
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={inputId}>
        {label}
      </label>
      {children({ inputId, describedBy: invalid ? errorId : undefined, invalid })}
      {invalid && (
        <p className="ds-hint" id={errorId} role="alert">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  inputId: string;
  describedBy?: string;
  invalid?: boolean;
}

export function Input({ inputId, describedBy, invalid, className, ...rest }: InputProps) {
  return (
    <input
      id={inputId}
      className={['ds-input', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );
}
