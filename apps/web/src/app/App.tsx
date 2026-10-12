/**
 * Bootstrap de la PWA — MVP S1 («hola mundo» con tokens Clay Serenity).
 * Proveedores reales (Theme, Router, VaultGate) según BLUEPRINTS en S2+.
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS.md → apps/web/src/app/App.tsx
 */
import { useSyncExternalStore } from 'react';
import { csColors, csLogo } from '@monedero/tokens';

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

export default function App() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        gap: 'var(--cs-space-4)',
        fontFamily: 'var(--cs-font-ui)',
        background: csColors.bgBase,
        color: csColors.textPrimary,
        padding: 'var(--cs-space-5)',
        textAlign: 'center',
      }}
    >
      <div>
        <div
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            margin: '0 auto var(--cs-space-4)',
            borderRadius: '27%',
            background: csLogo.tileBg,
            color: csLogo.tileLetter,
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--cs-font-display)',
            fontWeight: csLogo.weight,
            fontSize: 44,
            boxShadow: 'var(--cs-clay)',
            transition: reducedMotion ? 'none' : 'transform var(--cs-dur-base) var(--cs-ease-spring)',
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
            margin: 'var(--cs-space-3) auto 0',
          }}
        >
          Gestor de gastos local — scaffold S1 listo. Tus datos nunca salen de tu dispositivo.
        </p>
      </div>
    </main>
  );
}
