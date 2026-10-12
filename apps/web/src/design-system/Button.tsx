/**
 * Button — primitiva Clay (manual SSOT §7.1).
 * Un SOLO botón primario por vista. Texto externo vía children (i18n: t('clave') en caller).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: ReactNode;
}

export function Button({ variant = 'primary', children, className, type, ...rest }: ButtonProps) {
  const classes = ['ds-btn', variant !== 'primary' ? `ds-btn--${variant}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type ?? 'button'} className={classes} {...rest}>
      {children}
    </button>
  );
}
