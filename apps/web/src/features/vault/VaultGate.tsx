/**
 * VaultGate — blueprint BP-02 (pantalla de bloqueo).
 * 4 estados: loading (busy), empty (sin bóveda → Onboarding), locked (formulario), error (passphrase).
 * Fuente: BLUEPRINTS_DE_PANTALLAS.md BP-02 · HU-02.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, Field, Input } from '../../design-system';
import type { OnboardingStrings } from './Onboarding';
import { Onboarding } from './Onboarding';
import { useVaultStore } from './store';

export interface VaultGateStrings {
  lockTitle: string;
  lockCopy: string;
  passphraseLabel: string;
  unlock: string;
  loading: string;
  errorWrong: string;
  successTitle: string;
  successCopy: string;
  successCta: string;
  onboarding: OnboardingStrings;
}

export function VaultGate({ s, children }: { s: VaultGateStrings; children?: ReactNode }) {
  const status = useVaultStore((st) => st.status);
  const error = useVaultStore((st) => st.error);
  const busy = useVaultStore((st) => st.busy);
  const unlock = useVaultStore((st) => st.unlock);
  const createVault = useVaultStore((st) => st.createVault);
  const boot = useVaultStore((st) => st.boot);
  const [justCreated, setJustCreated] = useState(false);

  // Arranque: leer persistencia una sola vez (estado inicial 'boot').
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    if (!booted) {
      boot();
      setBooted(true);
    }
  }, [booted, boot]);

  if (status === 'boot') {
    return (
      <Card>
        <p role="status" style={{ textAlign: 'center', color: 'var(--cs-text-muted)' }}>
          <span className="ds-spinner" style={{ display: 'inline-block' }} role="presentation" /> …
        </p>
      </Card>
    );
  }

  if (status === 'no-vault' && !justCreated) {
    return (
      <Onboarding
        s={s.onboarding}
        onCreate={async (pass, confirm) => {
          const ok = await createVault(pass, confirm);
          if (ok) setJustCreated(true); // BP-01 paso 4: éxito lo renderiza el gate (evita desmonte)
          return ok;
        }}
      />
    );
  }

  // BP-01 paso 4/4 — éxito tras crear la bóveda (estado local, sobrevive al cambio de status)
  if (justCreated) {
    return (
      <Card>
        <section role="status" aria-live="polite" style={{ textAlign: 'center' }}>
          <div className="ds-empty__icon" aria-hidden="true" style={{ margin: '0 auto 12px' }}>
            🔐
          </div>
          <h1 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 24, margin: '0 0 8px' }}>
            {s.successTitle}
          </h1>
          <p style={{ color: 'var(--cs-text-muted)', fontSize: 14, marginBottom: 24 }}>{s.successCopy}</p>
          <Button onClick={() => setJustCreated(false)} style={{ width: '100%' }}>
            {s.successCta}
          </Button>
        </section>
      </Card>
    );
  }

  // Desbloqueada → el contenido lo aporta el padre (dashboard S3)
  if (status === 'unlocked') {
    return <>{children}</>;
  }

  return (
    <Card aria-labelledby="vg-title">
      <div className="ds-empty__icon" aria-hidden="true" style={{ margin: '0 auto 12px' }}>
        🔐
      </div>
      <h1 id="vg-title" style={{ fontFamily: 'var(--cs-font-display)', fontSize: 24, textAlign: 'center', margin: '0 0 8px' }}>
        {s.lockTitle}
      </h1>
      <p style={{ color: 'var(--cs-text-muted)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>{s.lockCopy}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void unlock(String(data.get('pass') ?? ''));
        }}
      >
        <Field label={s.passphraseLabel} error={error === 'VAULT_WRONG_PASSPHRASE' ? s.errorWrong : undefined}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              inputId={inputId}
              describedBy={describedBy}
              invalid={invalid}
              name="pass"
              type="password"
              autoComplete="current-password"
              placeholder={s.passphraseLabel}
              disabled={busy}
            />
          )}
        </Field>
        <Button type="submit" disabled={busy} style={{ width: '100%', marginTop: 20 }}>
          {busy ? s.loading : s.unlock}
        </Button>
      </form>
    </Card>
  );
}
