/**
 * Bootstrap de la PWA — I18nProvider + BP-01/BP-02 (vault) + showcase DS en /design-system.
 * i18n: cero strings hardcodeados → useT() (gate i18n:check).
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS.md → apps/web/src/app/App.tsx
 */
import { useSyncExternalStore } from 'react';
import { csColors, csLogo } from '@monedero/tokens';
import { I18nProvider, useT } from '@monedero/i18n/react';
import Showcase from '../design-system/Showcase';
import '../design-system/components.css';
import { VaultGate } from '../features/vault/VaultGate';

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
  const t = useT();
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
        {t('app.name')}
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
        {t('home.lead')}
      </p>
    </div>
  );
}

function Shell() {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();

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
        <VaultGate>
          <p role="status" style={{ textAlign: 'center', color: csColors.primary, fontSize: 14 }}>
            {t('home.unlocked')}
          </p>
        </VaultGate>
      </div>
    </main>
  );
}

export default function App() {
  // Ruta interna de desarrollo: galería viva del Design System (Paso 3).
  const isShowcase =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/design-system');
  if (isShowcase) return <Showcase />;

  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
