/**
 * Bootstrap de la PWA — I18nProvider + BP-01/BP-02 (vault) + AppShell
 * (BP-03 Inicio · BP-04 Movimientos · BP-05 alta) + showcase DS en /design-system.
 * i18n: cero strings hardcodeados → useT() (gate i18n:check).
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS.md → apps/web/src/app/App.tsx
 */
import { useState } from 'react';
import { csColors, csLogo } from '@monedero/tokens';
import { I18nProvider, useT } from '@monedero/i18n/react';
import Showcase from '../design-system/Showcase';
import { Segmented, usePrefersReducedMotion } from '../design-system';
import '../design-system/components.css';
import { VaultGate } from '../features/vault/VaultGate';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { TransactionsScreen } from '../features/transactions/TransactionsScreen';
import { BudgetsScreen } from '../features/budgets/BudgetsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

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

/**
 * AppShell — navegación Inicio (BP-03) ↔ Movimientos (BP-04/05) tras el
 * VaultGate. Ambos paneles quedan MONTADOS (hidden) para conservar el estado
 * de cada pantalla; comparten la sesión de repo → los eventos 'tx' del alta
 * actualizan el balance del dashboard (tarea 4.3). El CTA del dashboard abre
 * el alta mediante addSignal.
 */
function AppShell() {
  const t = useT();
  const [tab, setTab] = useState<'home' | 'tx' | 'budgets' | 'settings'>('home');
  const [addSignal, setAddSignal] = useState(0);

  return (
    <div style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
      <Segmented
        label={t('nav.sections')}
        options={[
          { value: 'home', label: t('home.title') },
          { value: 'tx', label: t('tx.list.title') },
          { value: 'budgets', label: t('budgets.title') },
          { value: 'settings', label: t('settings.title') },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div hidden={tab !== 'home'}>
        <DashboardScreen
          currency="COP"
          onAddFirst={() => {
            setTab('tx');
            setAddSignal((n) => n + 1);
          }}
          onSeeAll={() => setTab('tx')}
        />
      </div>
      <div hidden={tab !== 'tx'}>
        <TransactionsScreen currency="COP" addSignal={addSignal} />
      </div>
      <div hidden={tab !== 'budgets'}>
        <BudgetsScreen currency="COP" />
      </div>
      <div hidden={tab !== 'settings'}>
        <SettingsScreen />
      </div>
    </div>
  );
}

function Shell() {
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
          <AppShell />
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
