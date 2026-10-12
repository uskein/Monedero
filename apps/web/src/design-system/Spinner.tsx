/**
 * Spinner — carga (manual SSOT §7.5) con role=status (matriz A.3).
 * El texto lo aporta el caller (i18n).
 */
export interface SpinnerProps {
  label: string;
  size?: number;
}

export function Spinner({ label, size = 36 }: SpinnerProps) {
  return (
    <div
      className="ds-spinner"
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
    />
  );
}
