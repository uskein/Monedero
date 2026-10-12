/**
 * Progress — barra presupuestaria (manual SSOT §7.5).
 * Filosofía serena: primary → accent al 80% → danger al 100%.
 * Combinar SIEMPRE con texto/porcentaje (nunca solo color).
 */
export interface ProgressProps {
  /** 0–100+; >100 se muestra saturado al 100% y con tono over */
  percent: number;
  label: string;
}

function toneFor(percent: number): 'base' | 'warn' | 'over' {
  if (percent >= 100) return 'over';
  if (percent >= 80) return 'warn';
  return 'base';
}

export function Progress({ percent, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const tone = toneFor(percent);
  return (
    <div
      className="ds-progress"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={['ds-progress__fill', tone !== 'base' ? `ds-progress__fill--${tone}` : ''].filter(Boolean).join(' ')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
