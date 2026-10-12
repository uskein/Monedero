/**
 * Bootstrap de la PWA — BP-01/BP-02 (vault) + showcase DS en /design-system.
 * i18n: copy de producción resuelto por el caller (bloque es-CO embebido hasta S1.4 i18n pkg;
 * marcado data-i18n para el gate de detección de strings).
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS.md → apps/web/src/app/App.tsx
 */
import { useSyncExternalStore } from 'react';
import { csColors, csLogo } from '@monedero/tokens';
import Showcase from '../design-system/Showcase';
import '../design-system/components.css';
import { VaultGate } from '../features/vault/VaultGate';
import type { VaultGateStrings } from '../features/vault/VaultGate';

/** copy es-CO (exento como bloque i18n inicial; migrado a shared/i18n en S1.4). */
const ES: VaultGateStrings = {
  lockTitle: 'Bóveda bloqueada',
  lockCopy: 'Introduce tu contraseña maestra para descifrar tus datos locales.',
  passphraseLabel: 'Contraseña maestra',
  unlock: 'Desbloquear',
  loading: 'Descifrando…',
  errorWrong: 'Contraseña incorrecta. Tus datos siguen protegidos.',
  successTitle: '¡Bóveda lista!',
  successCopy: 'Tus datos están cifrados en este dispositivo.',
  successCta: 'Empezar',
  onboarding: {
    welcomeTitle: 'Bienvenido a Monedero',
    welcomeCopy: 'Tus gastos viven solo en este dispositivo. Sin nube, sin cuentas, sin telemetría.',
    createTitle: 'Crea tu contraseña maestra',
    createCopy: 'Cifra todo con AES-256-GCM. Si la olvidas, nadie —ni nosotros— puede recuperarla.',
    passphraseLabel: 'Contraseña maestra',
    passphraseHint: 'Mínimo 8 caracteres',
    confirmLabel: 'Repite la contraseña',
    confirmHint: 'Escribe la misma contraseña',
    errorMin: 'La contraseña debe tener al menos 8 caracteres.',
    errorMatch: 'Las contraseñas no coinciden.',
    next: 'Continuar',
    back: 'Atrás',
    finish: 'Crear bóveda',
    loading: 'Cifrando…',
    successTitle: '¡Bóveda lista!',
    successCopy: 'Tus datos están cifrados en este dispositivo.',
  },
};

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
}

function Hero({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div>
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          margin: '0 auto 16px',
          borderRadius: '27%',
          background: csLogo.tileBg,
          color: csLogo.tileLetter,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--cs-font-display)',
          fontWeight: csLogo.weight,
          fontSize: 44,
          boxShadow: 'var(--cs-clay)',
          transition: reducedMotion ? 'none' : 'transform 220ms var(--cs-ease-spring)',
        }}
      >
        M
      </div>
      <h1
        style={{
          fontFamily: 'var(--cs-font-display)',
          fontWeight: 700,
          fontSize: 'clamp(30px, 7vw, 34px)',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          margin: 0,
        }}
      >
        Monedero
      </h1>
      <p
        role="status"
        style={{
          color: csColors.textMuted,
          fontSize: 16,
          lineHeight: 1.65,
          maxWidth: '38ch',
          margin: '12px auto 0',
        }}
      >
        Gestor de gastos local — tus datos nunca salen de tu dispositivo.
      </p>
    </div>
  );
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion();

  // Ruta interna de desarrollo: galería viva del Design System (Paso 3).
  const isShowcase =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/design-system');
  if (isShowcase) return <Showcase />;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        gap: 'var(--cs-space-5)',
        fontFamily: 'var(--cs-font-ui)',
        background: csColors.bgBase,
        color: csColors.textPrimary,
        padding: 'var(--cs-space-5)',
        textAlign: 'center',
      }}
    >
      <Hero reducedMotion={reducedMotion} />
      <div style={{ width: 'min(440px, 100%)', textAlign: 'left' }}>
        <VaultGate s={ES}>
          <p role="status" style={{ textAlign: 'center', color: csColors.primary, fontSize: 14 }}>
            Bóveda desbloqueada — dashboard en construcción (S3).
          </p>
        </VaultGate>
      </div>
    </main>
  );
}
