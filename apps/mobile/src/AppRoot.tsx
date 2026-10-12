/**
 * AppRoot — composición raíz móvil (inyección de puertos → UI).
 * Estructura: I18nProvider → Hero (wordmark + privacidad) → VaultGate
 * (BP-01/BP-02) → AppShell con pestañas Inicio/Movimientos: AMBAS pantallas
 * montadas (la oculta con display:'none', espejo del `hidden` de la PWA) para
 * conservar el estado de cada una. El repo dev (sql.js, sustituible por
 * SQLCipher al llegar el build nativo) se crea tras desbloquear: no se toca la
 * BD con la bóveda cerrada. i18n: cero strings hardcodeados → t().
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS → apps/mobile/src/AppRoot.tsx ·
 * BLUEPRINTS BP-01..05 · PLAN_DE_SPRINTS 4.4 (Gate S4).
 */
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { I18nProvider, useT } from '@monedero/i18n/react';
import { csColors, csLogo, csRadius, csSpace } from '@monedero/tokens';
import { configureVaultStorage } from './state/vault.store';
import { createSecureStoreStorage } from './infrastructure/security/secureStoreStorage';
import { createDevRepository, type DevRepository } from './infrastructure/db/createDevRepository';
import { VaultGate } from './ui/screens/VaultGate';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { TransactionsScreen } from './ui/screens/TransactionsScreen';
import { BudgetsScreen } from './ui/screens/BudgetsScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

// Raíz de composición: el puerto de la bóveda se inyecta al cargar el módulo,
// ANTES del primer render (VaultGate arranca su boot en un efecto hijo, que se
// ejecuta antes que cualquier efecto padre). Los tests lo sustituyen con
// configureVaultStorage(createMemoryVaultStorage()) tras importar y antes de
// renderizar; expo-secure-store no se carga nunca en jest (import dinámico).
configureVaultStorage(createSecureStoreStorage());

export default function AppRoot() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}

function Shell() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <Hero />
      <View style={styles.body}>
        <VaultGate>
          <AppShell />
        </VaultGate>
      </View>
    </SafeAreaView>
  );
}

/** Wordmark + promesa de privacidad (espejo del Hero de la PWA). */
function Hero() {
  const t = useT();
  return (
    <View style={styles.hero}>
      <View style={styles.tile} accessibilityRole="image" accessibilityLabel="Monedero, logotipo">
        <Text style={styles.tileLetter}>M</Text>
      </View>
      <Text style={styles.title}>{t('app.name')}</Text>
      <Text style={styles.lead} accessibilityLiveRegion="polite">
        {t('home.lead')}
      </Text>
    </View>
  );
}

/**
 * AppShell — pestañas Inicio (BP-03) ↔ Movimientos (BP-04/05) tras el
 * VaultGate. Ambos paneles quedan MONTADOS (el oculto con display:'none') para
 * conservar el estado de cada pantalla; comparten la misma instancia de repo →
 * los eventos del alta actualizan el balance del dashboard (tarea 4.3). El CTA
 * del dashboard cambia de pestaña y abre el alta (addSignal).
 */
function AppShell() {
  const t = useT();
  const [tab, setTab] = useState<'home' | 'tx' | 'budgets' | 'settings'>('home');
  const [addSignal, setAddSignal] = useState(0);
  const [dev, setDev] = useState<DevRepository | null>(null);

  useEffect(() => {
    let alive = true;
    void createDevRepository().then((d) => {
      if (alive) setDev(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!dev) {
    return (
      <View style={styles.loading} accessibilityLiveRegion="polite">
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.tabs}>
        <NavTab label={t('home.title')} selected={tab === 'home'} onPress={() => setTab('home')} />
        <NavTab label={t('tx.list.title')} selected={tab === 'tx'} onPress={() => setTab('tx')} />
        <NavTab label={t('budgets.title')} selected={tab === 'budgets'} onPress={() => setTab('budgets')} />
        <NavTab label={t('settings.title')} selected={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>
      <View style={[styles.panel, tab !== 'home' && styles.hidden]}>
        <DashboardScreen
          repo={dev.repo}
          onAddFirst={() => {
            setTab('tx');
            setAddSignal((n) => n + 1);
          }}
          onSeeAll={() => setTab('tx')}
        />
      </View>
      <View style={[styles.panel, tab !== 'tx' && styles.hidden]}>
        <TransactionsScreen repo={dev.repo} addSignal={addSignal} />
      </View>
      <View style={[styles.panel, tab !== 'budgets' && styles.hidden]}>
        <BudgetsScreen budgets={dev.budgets} txRepo={dev.repo} categories={dev.categories} />
      </View>
      <View style={[styles.panel, tab !== 'settings' && styles.hidden]}>
        <SettingsScreen categories={dev.categories} />
      </View>
    </View>
  );
}

/** Pestaña de navegación (role=tab + estado selected, idéntico a PeriodTab). */
function NavTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected && styles.tabSelected]}
    >
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: csColors.bgBase },
  hero: { alignItems: 'center', paddingTop: csSpace.s5, paddingHorizontal: csSpace.s5 },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 72 * csLogo.radiusRatio,
    backgroundColor: csLogo.tileBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: csSpace.s4,
  },
  tileLetter: { color: csLogo.tileLetter, fontFamily: csLogo.font, fontWeight: '700', fontSize: 44 },
  title: {
    fontFamily: csLogo.font,
    fontWeight: '700',
    fontSize: 34,
    lineHeight: 37.4,
    letterSpacing: -0.34,
    color: csColors.textPrimary,
  },
  lead: {
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 26.4,
    color: csColors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: csSpace.s3,
  },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: csColors.textMuted },
  shell: { flex: 1 },
  tabs: { flexDirection: 'row', gap: csSpace.s2, paddingHorizontal: csSpace.s4, paddingBottom: csSpace.s2 },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
  },
  tabSelected: { backgroundColor: csColors.primary },
  tabLabel: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary },
  tabLabelSelected: { color: csColors.textOnPrimary },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
