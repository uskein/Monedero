/**
 * EmptyState — vacío amable (manual SSOT §7.5). Copy y CTA en i18n (caller).
 */
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  copy: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '🌱', title, copy, action }: EmptyStateProps) {
  return (
    <div className="ds-empty">
      <div className="ds-empty__icon" aria-hidden="true">
        {icon}
      </div>
      <p className="ds-empty__title">{title}</p>
      <p className="ds-empty__copy">{copy}</p>
      {action}
    </div>
  );
}
