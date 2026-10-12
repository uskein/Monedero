/**
 * DashboardScreen (móvil) — BP-03 «Inicio» (HU-08·09·12). Espejo de la PWA.
 * Responde «¿cuánto queda?»: balance total con contador animado (respeta
 * «reducir movimiento»), periodo (Este mes/Mes anterior), ingreso/gasto del
 * mes y últimos movimientos. 4 estados DoD: loading · empty (CTA) · success ·
 * error (retry). Copy vía useI18n() — cero strings hardcodeados (i18n:check).
 * Trazabilidad: BLUEPRINTS BP-03 · PLAN_DE_SPRINTS 4.2/4.3.
 */
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@monedero/i18n/react';
import { formatMonthLabel, monthKeyOf, previousMonthKey } from '@monedero/i18n';
import type { TranslationKey } from '@monedero/i18n';
import { csColors, csRadius, csSpace } from '@monedero/tokens';
import { Button, Card } from '../design-system';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useCountUp } from '../hooks/useCountUp';
import { CATEGORY_NAMES } from './catalog';
import { shortDate } from './TransactionList';
import { useDashboardStore, type DashboardRepo } from '../../state/dashboard.store';
import type { Transaction, TxType } from '../../core/domain/transaction';

// Font display de Clay Serenity (misma convención literal que TransactionList).
const FONT_DISPLAY = 'Fraunces';

export interface DashboardScreenProps {
  /** Puerto inyectado (hexagonal): en prod el repo SQLCipher/sql.js de sesión. */
  repo: DashboardRepo;
  currency?: 'COP' | 'USD' | 'EUR';
  /** CTA «Añadir primer movimiento» → abre el alta (BP-05). */
  onAddFirst?: () => void;
  /** «Movimientos» → salta a la lista (BP-04). */
  onSeeAll?: () => void;
}

const TYPE_LABEL: Record<'expense' | 'income' | 'transfer', TranslationKey> = {
  expense: 'tx.type.expense',
  income: 'tx.type.income',
  transfer: 'tx.type.transfer',
};

const TYPE_ICON: Record<TxType, keyof typeof Ionicons.glyphMap> = {
  expense: 'arrow-up',
  income: 'arrow-down',
  transfer: 'swap-horizontal',
};

function categoryLabel(tx: Transaction, t: (key: TranslationKey) => string): string {
  if (tx.categoryId) return CATEGORY_NAMES[tx.categoryId] ?? tx.categoryId;
  return t(TYPE_LABEL[tx.type]);
}

export function DashboardScreen({ repo, currency = 'COP', onAddFirst, onSeeAll }: DashboardScreenProps) {
  const { t, locale, money, moneySigned } = useI18n();
  const status = useDashboardStore((s) => s.status);
  const month = useDashboardStore((s) => s.month);
  const summary = useDashboardStore((s) => s.summary);
  const latest = useDashboardStore((s) => s.latest);
  const init = useDashboardStore((s) => s.init);
  const setMonth = useDashboardStore((s) => s.setMonth);
  const refresh = useDashboardStore((s) => s.refresh);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    void init(repo);
  }, [init, repo]);

  const currentMonth = monthKeyOf(new Date());
  const total = summary?.totalBalanceCents ?? 0;
  const displayCents = useCountUp(total, reducedMotion);
  const monthBalance = summary?.monthBalanceCents ?? 0;

  // ── Loading (sin flash de vacío) ──
  if (status === 'loading') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('home.title')}>
        <View style={styles.center} accessibilityLiveRegion="polite">
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </ScrollView>
    );
  }

  // ── Error (reintento, blueprint BP-03) ──
  if (status === 'error') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('home.title')}>
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t('home.error')}
          </Text>
          <Button label={t('common.retry')} variant="secondary" onPress={() => void refresh()} />
        </View>
      </ScrollView>
    );
  }

  // ── Success / Empty ──
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('home.title')}>
      <Card>
        <Text style={styles.balanceLabel}>{t('home.balance')}</Text>
        {/* Sin live region: el lector lee el valor final al navegar (espejo PWA). */}
        <Text style={styles.balanceValue}>{money(displayCents, currency)}</Text>
        <Text style={styles.muted}>
          {t('home.month.balance')}: {moneySigned(monthBalance, currency, monthBalance >= 0)}
        </Text>

        {/* Fila de periodo: contenedor plano (misma convención que los chips de
            BP-04; un contenedor accessible ocultaría los tabs al lector). */}
        <View style={styles.periodRow}>
          <PeriodTab
            label={t('home.period.current')}
            selected={month === currentMonth}
            onPress={() => void setMonth(currentMonth)}
          />
          <PeriodTab
            label={t('home.period.previous')}
            selected={month === previousMonthKey(currentMonth)}
            onPress={() => void setMonth(previousMonthKey(currentMonth))}
          />
        </View>
      </Card>

      {status === 'empty' ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('tx.list.empty.title')}</Text>
          <Text style={styles.muted}>{t('tx.list.empty.copy')}</Text>
          {onAddFirst ? <Button label={t('tx.list.empty.cta')} onPress={onAddFirst} /> : null}
        </View>
      ) : (
        <>
          {/* Informe del periodo */}
          <Card>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {formatMonthLabel(month, locale)}
            </Text>
            <View style={styles.reportRow}>
              <Text style={styles.muted}>{t('home.month.income')}</Text>
              <Text style={styles.reportAmount}>{moneySigned(summary?.incomeCents ?? 0, currency, true)}</Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.muted}>{t('home.month.expense')}</Text>
              <Text style={styles.reportAmount}>{moneySigned(summary?.expenseCents ?? 0, currency, false)}</Text>
            </View>
          </Card>

          {/* Últimos movimientos */}
          <View style={styles.latestBlock}>
            <View style={styles.latestHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {t('home.latest')}
              </Text>
              {onSeeAll ? <Button label={t('tx.list.title')} variant="ghost" onPress={onSeeAll} /> : null}
            </View>
            {latest.map((tx) => {
              // Mismo lenguaje visual que las filas de Movimientos (BP-04).
              const meta = [categoryLabel(tx, t), shortDate(tx.date, locale)].join(' · ');
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View
                    accessibility-hidden="true"
                    style={[styles.txIcon, tx.type === 'income' && styles.txIconIncome]}
                  >
                    <Ionicons
                      name={TYPE_ICON[tx.type]}
                      size={20}
                      color={tx.type === 'income' ? csColors.primary : csColors.textPrimary}
                    />
                  </View>
                  <View style={styles.txBody}>
                    <Text style={styles.txTitle}>{tx.payee ?? t('tx.form.payee')}</Text>
                    <Text style={styles.muted}>{meta}</Text>
                  </View>
                  <Text style={[styles.txAmount, tx.type === 'income' && styles.income]}>
                    {moneySigned(tx.amountCents, currency, tx.type === 'income')}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function PeriodTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[styles.periodTab, selected && styles.periodTabSelected]}
    >
      <Text style={[styles.periodLabel, selected && styles.periodLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: csColors.bgBase },
  content: { gap: csSpace.s4, padding: csSpace.s4 },
  center: { alignItems: 'center', gap: csSpace.s3, paddingVertical: csSpace.s6 },
  muted: { fontSize: 13, color: csColors.textMuted },
  error: { fontSize: 14, color: csColors.danger, textAlign: 'center' },
  balanceLabel: { fontSize: 14, color: csColors.textMuted },
  balanceValue: { fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 34, color: csColors.textPrimary },
  periodRow: { flexDirection: 'row', gap: csSpace.s2, marginTop: csSpace.s3 },
  periodTab: {
    minHeight: 36,
    paddingHorizontal: csSpace.s3,
    paddingVertical: csSpace.s2,
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
  },
  periodTabSelected: { backgroundColor: csColors.primary },
  periodLabel: { fontSize: 13, color: csColors.textPrimary },
  periodLabelSelected: { color: csColors.textOnPrimary, fontWeight: '600' },
  sectionTitle: { fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 18, color: csColors.textPrimary },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', gap: csSpace.s3, paddingVertical: csSpace.s1 },
  reportAmount: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary },
  latestBlock: { gap: csSpace.s2 },
  latestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: csSpace.s3 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: csSpace.s3,
    paddingVertical: csSpace.s2,
    paddingHorizontal: csSpace.s3,
    marginVertical: csSpace.s1,
    backgroundColor: csColors.surface,
    borderRadius: csRadius.card,
    shadowColor: 'rgb(60, 50, 40)',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconIncome: { backgroundColor: csColors.primarySoft },
  txBody: { flex: 1, gap: 2 },
  txTitle: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary },
  txAmount: { fontSize: 15, fontWeight: '700', color: csColors.textPrimary },
  income: { color: csColors.primary },
  emptyTitle: { fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 18, color: csColors.textPrimary },
});
