/**
 * Onboarding — blueprint BP-01 (REQUERIMIENTOS_FUNCIONALES.md).
 * 3 pasos + éxito (renderizado por VaultGate como paso 4/4).
 * i18n: TODO el copy vía useT() — cero strings hardcodeados (gate i18n:check).
 * 4 estados (DoD): loading (busy), empty (paso inicial), success, error (validación).
 */
import { useState } from 'react';
import { useT } from '@monedero/i18n/react';
import { Button, Card, Field, Input, Progress } from '../../design-system';

export interface OnboardingProps {
  onCreate: (passphrase: string, confirm: string) => Promise<boolean>;
}

type Step = 0 | 1 | 2;

export function Onboarding({ onCreate }: OnboardingProps) {
  const t = useT();
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
    if (!ok) setError(t('vault.onboarding.error.min'));
  }

  return (
    <Card aria-labelledby="onb-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--cs-text-muted)' }}>
          {t('vault.onboarding.step', { current: step + 1, total })}
        </span>
        <span style={{ width: '60%' }}>
          <Progress
            percent={((step + 1) / total) * 100}
            label={t('vault.onboarding.step', { current: step + 1, total })}
          />
        </span>
      </div>

      {step === 0 && (
        <section>
          <h1 id="onb-title" style={{ fontFamily: 'var(--cs-font-display)', fontSize: 30, margin: '0 0 8px' }}>
            {t('vault.onboarding.welcome.title')}
          </h1>
          <p style={{ color: 'var(--cs-text-muted)', fontSize: 15, marginBottom: 24 }}>
            {t('vault.onboarding.welcome.copy')}
          </p>
          <Button onClick={() => setStep(1)}>{t('common.next')}</Button>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 id="onb-title" style={{ fontFamily: 'var(--cs-font-display)', fontSize: 22, margin: '0 0 8px' }}>
            {t('vault.onboarding.create.title')}
          </h1>
          <p style={{ color: 'var(--cs-text-muted)', fontSize: 14, marginBottom: 20 }}>
            {t('vault.onboarding.create.copy')}
          </p>
          <Field
            label={t('vault.onboarding.passphrase')}
            hint={t('vault.onboarding.passphrase.hint')}
            error={error ?? undefined}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                inputId={inputId}
                describedBy={describedBy}
                invalid={invalid}
                type="password"
                autoComplete="new-password"
                placeholder={t('vault.onboarding.passphrase.hint')}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            )}
          </Field>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setStep(0)}>
              {t('common.back')}
            </Button>
            <Button
              onClick={() => {
                if (pass.length < 8) setError(t('vault.onboarding.error.min'));
                else {
                  setError(null);
                  setStep(2);
                }
              }}
            >
              {t('common.next')}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 id="onb-title" style={{ fontFamily: 'var(--cs-font-display)', fontSize: 22, margin: '0 0 8px' }}>
            {t('vault.onboarding.confirm')}
          </h1>
          <Field
            label={t('vault.onboarding.confirm')}
            error={confirm.length > 0 && confirm !== pass ? t('vault.onboarding.error.match') : error ?? undefined}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                inputId={inputId}
                describedBy={describedBy}
                invalid={invalid}
                type="password"
                autoComplete="new-password"
                placeholder={t('vault.onboarding.confirm.hint')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
          </Field>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
              {t('common.back')}
            </Button>
            <Button onClick={finish} disabled={busy}>
              {busy ? t('vault.onboarding.busy') : t('vault.onboarding.finish')}
            </Button>
          </div>
        </section>
      )}
    </Card>
  );
}
