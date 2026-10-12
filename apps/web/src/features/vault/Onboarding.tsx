/**
 * Onboarding — blueprint BP-01 (REQUERIMIENTOS_FUNCIONALES.md).
 * 4 pasos: bienvenida → crear passphrase → confirmar → éxito (VaultGate).
 * 4 estados por pantalla (DoD): loading (busy), empty (paso inicial), success, error (VALIDATION_FAILED).
 * Copy: TODO vía props i18n — aquí se reciben como strings (caller resuelve t('...')).
 */
import { useState } from 'react';
import { Button, Card, Field, Input, Progress } from '../../design-system';

export interface OnboardingStrings {
  welcomeTitle: string;
  welcomeCopy: string;
  createTitle: string;
  createCopy: string;
  passphraseLabel: string;
  passphraseHint: string;
  confirmLabel: string;
  confirmHint: string;
  errorMin: string;
  errorMatch: string;
  next: string;
  back: string;
  finish: string;
  loading: string;
  successTitle: string;
  successCopy: string;
}

export interface OnboardingProps {
  s: OnboardingStrings;
  onCreate: (passphrase: string, confirm: string) => Promise<boolean>;
}

type Step = 0 | 1 | 2;

export function Onboarding({ s, onCreate }: OnboardingProps) {
  const [step, setStep] = useState<Step>(0);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = 4;

  async function finish() {
    setBusy(true);
    // Éxito: el padre (VaultGate) monta la pantalla 4/4 vía su estado local.
    const ok = await onCreate(pass, confirm);
    setBusy(false);
    if (!ok) setError(s.errorMin); // validación fallida (store → VALIDATION_FAILED)
  }

  return (
    <Card aria-labelledby="onb-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--cs-text-muted)' }}>
          {step + 1}/{total}
        </span>
        <span style={{ width: '60%' }}>
          <Progress percent={((step + 1) / total) * 100} label={`${step + 1} de ${total}`} />
        </span>
      </div>

      {step === 0 && (
        <section>
          <h1 id="onb-title" style={{ fontFamily: 'var(--cs-font-display)', fontSize: 30, margin: '0 0 8px' }}>
            {s.welcomeTitle}
          </h1>
          <p style={{ color: 'var(--cs-text-muted)', fontSize: 15, marginBottom: 24 }}>{s.welcomeCopy}</p>
          <Button onClick={() => setStep(1)}>{s.next}</Button>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 id="onb-title" style={{ fontFamily: 'var(--cs-font-display)', fontSize: 22, margin: '0 0 8px' }}>
            {s.createTitle}
          </h1>
          <p style={{ color: 'var(--cs-text-muted)', fontSize: 14, marginBottom: 20 }}>{s.createCopy}</p>
          <Field label={s.passphraseLabel} hint={s.passphraseHint} error={error ?? undefined}>
            {({ inputId }) => (
              <Input
                inputId={inputId}
                type="password"
                autoComplete="new-password"
                placeholder={s.passphraseHint}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            )}
          </Field>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setStep(0)}>
              {s.back}
            </Button>
            <Button
              onClick={() => {
                if (pass.length < 8) setError(s.errorMin);
                else {
                  setError(null);
                  setStep(2);
                }
              }}
            >
              {s.next}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 id="onb-title" style={{ fontFamily: 'var(--cs-font-display)', fontSize: 22, margin: '0 0 8px' }}>
            {s.confirmLabel}
          </h1>
          <Field label={s.confirmLabel} error={error !== null && confirm.length > 0 && confirm !== pass ? s.errorMatch : undefined}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                inputId={inputId}
                describedBy={describedBy}
                invalid={invalid}
                type="password"
                autoComplete="new-password"
                placeholder={s.confirmHint}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
          </Field>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
              {s.back}
            </Button>
            <Button onClick={finish} disabled={busy}>
              {busy ? s.loading : s.finish}
            </Button>
          </div>
        </section>
      )}
    </Card>
  );
}
