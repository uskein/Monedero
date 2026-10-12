/**
 * Card — contenedor elevado Clay (manual SSOT §7.3). Nunca borde oscuro.
 */
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div className={['ds-card', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
