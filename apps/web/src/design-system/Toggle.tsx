/**
 * Toggle — switch Clay (manual SSOT §7.4) con role=switch (matriz A.3).
 */
export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="ds-toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}
