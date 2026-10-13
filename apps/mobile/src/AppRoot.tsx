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
import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { I18nProvider, useT } from '@monedero/i18n/react';
import { csLogo, csRadius, csSpace } from '@monedero/tokens';
import { configureVaultStorage, getVaultPort, useVaultStore } from './state/vault.store';
import { createSecureStoreStorage } from './infrastructure/security/secureStoreStorage';
import { createDevRepository, type DevRepository } from './infrastructure/db/createDevRepository';
import { VaultGate } from './ui/screens/VaultGate';
import { AppErrorBoundary } from './ui/AppErrorBoundary';
import { BusyIndicator } from './ui/design-system';
import { ThemeProvider, useThemeColors, useThemeScheme } from './ui/theme';
import { usePrefsStore } from './state/prefs.store';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { TransactionsScreen } from './ui/screens/TransactionsScreen';
import { BudgetsScreen } from './ui/screens/BudgetsScreen';
import { ReportsScreen } from './ui/screens/ReportsScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

// Raíz de composición: el puerto de la bóveda se inyecta al cargar el módulo,
// ANTES del primer render (VaultGate arranca su boot en un efecto hijo, que se
// ejecuta antes que cualquier efecto padre). Los tests lo sustituyen con
// configureVaultStorage(createMemoryVaultStorage()) tras importar y antes de
// renderizar; expo-secure-store no se carga nunca en jest (import dinámico).
configureVaultStorage(createSecureStoreStorage());

export default function AppRoot() {
  // Preferencias (tema HU-17 · moneda HU-18): se cargan una vez; los defaults
  // ('light'/'COP') se aplican al instante y el store re-renderiza al llegar.
  useEffect(() => {
    void usePrefsStore.getState().init();
  }, []);
  return (
    <I18nProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </I18nProvider>
  );
}

function Shell() {
  const t = useT();
  const c = useThemeColors();
  const scheme = useThemeScheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* Marca mínima en la esquina: el protagonismo es de la app. */}
      <View style={styles.header} accessibilityRole="image" accessibilityLabel={t('brand.logo.label')}>
        <View style={styles.tile}>
          <Text style={styles.tileLetter}>M</Text>
        </View>
      </View>
      <View style={styles.body}>
        <AppErrorBoundary>
          <VaultGate>
            <AppShell />
          </VaultGate>
        </AppErrorBoundary>
      </View>
      {/* Promesa de privacidad como footer sereno (letra pequeña). */}
      <Text style={styles.footer} accessibilityLiveRegion="polite">
        {t('home.lead')}
      </Text>
    </SafeAreaView>
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
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  /** Moneda GLOBAL (HU-18) — la de Ajustes; cada pantalla puede sobre-escribir. */
  const currency = usePrefsStore((s) => s.currency);
  /** uuid de la bóveda (HU-14: viaja en el fichero exportado). */
  const vaultId = useVaultStore((s) => s.vaultId);
  const [tab, setTab] = useState<'home' | 'tx' | 'budgets' | 'reports' | 'settings'>('home');
  const [addSignal, setAddSignal] = useState(0);
  const [dev, setDev] = useState<DevRepository | null>(null);

  useEffect(() => {
    let alive = true;
    // Persistencia cifrada interina (ADR-003): el snapshot se sella con la
    // clave de bóveda (KeyVault.encryptBytes) — la clave nunca sale de ahí.
    void createDevRepository({ crypto: getVaultPort() ?? undefined }).then((d) => {
      if (__DEV__) console.warn('[monedero] repo dev listo (sql.js asm + snapshot cifrado)');
      if (alive) setDev(d);
      else d.dispose();
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!dev) {
    return <BusyIndicator label={t('common.loading')} />;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.tabs}>
        <NavTab icon="home" label={t('home.title')} selected={tab === 'home'} onPress={() => setTab('home')} />
        <NavTab icon="receipt" label={t('tx.list.title')} selected={tab === 'tx'} onPress={() => setTab('tx')} />
        <NavTab icon="wallet" label={t('budgets.title')} selected={tab === 'budgets'} onPress={() => setTab('budgets')} />
        <NavTab icon="pie-chart" label={t('reports.title')} selected={tab === 'reports'} onPress={() => setTab('reports')} />
        <NavTab icon="settings" label={t('settings.title')} selected={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>
      <View style={[styles.panel, tab !== 'home' && styles.hidden]}>
        <DashboardScreen
          repo={dev.repo}
          currency={currency}
          onAddFirst={() => {
            setTab('tx');
            setAddSignal((n) => n + 1);
          }}
          onSeeAll={() => setTab('tx')}
        />
      </View>
      <View style={[styles.panel, tab !== 'tx' && styles.hidden]}>
        <TransactionsScreen repo={dev.repo} currency={currency} addSignal={addSignal} />
      </View>
      <View style={[styles.panel, tab !== 'budgets' && styles.hidden]}>
        <BudgetsScreen budgets={dev.budgets} txRepo={dev.repo} categories={dev.categories} currency={currency} />
      </View>
      <View style={[styles.panel, tab !== 'reports' && styles.hidden]}>
        <ReportsScreen repo={dev.repo} currency={currency} />
      </View>
      <View style={[styles.panel, tab !== 'settings' && styles.hidden]}>
        <SettingsScreen categories={dev.categories} db={dev.db} vaultId={vaultId} />
      </View>
    </View>
  );
}

/**
 * Pestaña de navegación por ICONO (los textos se desbordan en pantallas
 * estrechas). El nombre accesible sigue siendo el texto i18n: role=tab +
 * accessibilityLabel garantizan la matriz A.3 y que los journey tests
 * (getByRole('tab', {name})) sigan funcionando.
 */
function NavTab({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected && styles.tabSelected]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={selected ? c.textOnPrimary : c.textPrimary}
      />
    </Pressable>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bgBase },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: csSpace.s4,
      paddingTop: csSpace.s2,
      paddingBottom: csSpace.s1,
    },
    tile: {
      width: 36,
      height: 36,
      borderRadius: 36 * csLogo.radiusRatio,
      backgroundColor: csLogo.tileBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLetter: { color: csLogo.tileLetter, fontFamily: csLogo.font, fontWeight: '700', fontSize: 20 },
    // minHeight: seguro contra colapso de altura en arranques nativos raros
    // (el contenido del VaultGate es flex:1; sin cota mínima quedaría invisible).
    body: { flex: 1, minHeight: 320 },
    footer: {
      fontSize: 11,
      lineHeight: 16,
      color: c.textMuted,
      textAlign: 'center',
      paddingHorizontal: csSpace.s5,
      paddingVertical: csSpace.s2,
    },
    shell: { flex: 1 },
    tabs: { flexDirection: 'row', gap: csSpace.s2, paddingHorizontal: csSpace.s4, paddingBottom: csSpace.s2 },
    tab: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: csRadius.pill,
      backgroundColor: c.surfaceSunken,
    },
    tabSelected: { backgroundColor: c.primary },
    panel: { flex: 1 },
    hidden: { display: 'none' },
  });
}
