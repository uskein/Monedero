/**
 * Chip — badge semántico (manual SSOT §7.5).
 * Nunca solo color: siempre texto (+ signo/ícono en caller).
 */
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

export type ChipTone = 'income' | 'expense' | 'pending';

interface ChipBase {
  tone: ChipTone;
}

export interface ChipProps extends ChipBase, HTMLAttributes<HTMLSpanElement> {}

export function Chip({ tone, children, className, ...rest }: ChipProps) {
  return (
    <span className={['ds-chip', `ds-chip--${tone}`, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}

export interface ChipButtonProps extends ChipBase, ButtonHTMLAttributes<HTMLButtonElement> {}

/** Chip interactivo (filtro/selección) — operable por teclado con focus visible. */
export function ChipButton({ tone, children, className, type, ...rest }: ChipButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={['ds-chip', `ds-chip--${tone}`, 'ds-chip--interactive', className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
