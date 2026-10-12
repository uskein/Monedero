/**
 * Toast — feedback (manual SSOT §7.5).
 * role=status (polite) para éxito/aviso; role=alert (assertive) para error.
 * Nunca roba el foco (a11y A.3).
 */
import type { ReactNode } from 'react';

export type ToastTone = 'success' | 'warn' | 'error';

export interface ToastProps {
  tone: ToastTone;
  children: ReactNode;
}

export function Toast({ tone, children }: ToastProps) {
  return (
    <div
      className={['ds-toast', tone !== 'success' ? `ds-toast--${tone}` : ''].filter(Boolean).join(' ')}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
