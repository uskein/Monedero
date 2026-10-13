/**
 * ReportsScreen (móvil) — BP-07 «Reportes» · HU-13. Espejo del plan (PWA en S6+).
 * Donut con paleta SEMÁNTICA de tokens + role=image/label (HU-13) y SIEMPRE
 * tabla alternativa visible (dot + nombre + monto + %): nunca solo color.
 * 4 estados DoD · mes segmentado (Este mes / Mes anterior) · reevalúa ante
 * eventos de movimientos (store). Copy i18n — cero strings hardcodeados.
 */
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@monedero/i18n/react';
import { monthKeyOf, previousMonthKey } from '@monedero/i18n';
import { csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, DonutChart } from '../design-system';
import { useThemeColors, type ThemeColors } from '../theme';
import { CATEGORY_NAMES } from './catalog';
import { useReportsStore, type ReportsRepo } from '../../state/reports.store';

/** Paleta del donut: SOLO tokens --cs-* de la PALETA ACTIVA (HU-13). */
function donutColors(c: ThemeColors): string[] {
  return [c.primary, c.secondary, c.accent, c.textMuted, c.primarySoft];
}

export interface ReportsScreenProps {
  repo: ReportsRepo;
  currency?: 'COP' | 'USD' | 'EUR';
}

export function ReportsScreen({ repo, currency = 'COP' }: ReportsScreenProps) {
  const { t, money } = useI18n();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const month = useReportsStore((s) => s.month);
  const status = useReportsStore((s) => s.status);
  const report = useReportsStore((s) => s.report);
  const init = useReportsStore((s) => s.init);
  const setMonth = useReportsStore((s) => s.setMonth);

  useEffect(() => {
    void init(repo);
  }, [init, repo]);

  const currentMonth = monthKeyOf(new Date());
  const previousMonth = previousMonthKey(currentMonth);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('reports.title')}>
      <Text style={styles.title}>{t('reports.title')}</Text>

      {/* Mes segmentado (BP-07 .segmented) */}
      <View style={styles.monthRow}>
        <MonthChip
          label={t('home.period.current')}
          selected={month === currentMonth}
          onPress={() => void setMonth(currentMonth)}
        />
        <MonthChip
          label={t('home.period.previous')}
          selected={month === previousMonth}
          onPress={() => void setMonth(previousMonth)}
        />
      </View>

      {status === 'loading' ? (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {t('common.loading')}
        </Text>
      ) : status === 'error' ? (
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t('reports.error')}
          </Text>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void setMonth(month)} />
        </View>
      ) : status === 'empty' || !report ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('reports.empty.title')}</Text>
          <Text style={styles.muted}>{t('reports.empty.copy')}</Text>
        </View>
      ) : (
        <>
          {/* Resumen del mes */}
          <Card style={styles.card}>
            <View style={styles.reportRow}>
              <Text style={styles.muted}>{t('home.month.income')}</Text>
              <Text style={styles.reportAmount}>{money(report.incomeCents, currency)}</Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.muted}>{t('reports.total')}</Text>
              <Text style={styles.reportAmount}>{money(report.expenseCents, currency)}</Text>
            </View>
            <View style={styles.reportRow}>
              <Text style={styles.muted}>{t('home.month.balance')}</Text>
              <Text style={styles.reportAmount}>{money(report.balanceCents, currency)}</Text>
            </View>
          </Card>

          {/* Donut (HU-13: role=image + label) + tabla alternativa visible */}
          <Card style={styles.card}>
            <DonutChart
              label={`${t('reports.chart')}: ${money(report.expenseCents, currency)}`}
              segments={report.byCategory.map((i2, i) => ({
                key: i2.categoryId || 'sin-categoria',
                percent: i2.percent,
                color: donutColors(c)[i % donutColors(c).length] ?? c.primary,
              }))}
            />
            <View style={styles.legend}>
              {report.byCategory.map((i2, i) => (
                <View key={i2.categoryId || 'sin-categoria'} style={styles.legendRow}>
                  <View
                    accessibility-hidden="true"
                    style={[styles.dot, { backgroundColor: donutColors(c)[i % donutColors(c).length] ?? c.primary }]}
                  />
                  <Text style={styles.legendName}>
                    {i2.categoryId ? (CATEGORY_NAMES[i2.categoryId] ?? i2.categoryId) : t('reports.uncategorized')}
                  </Text>
                  <Text style={styles.legendAmount}>{money(i2.amountCents, currency)}</Text>
                  <Text style={styles.muted}>{`${Math.round(i2.percent)} %`}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function MonthChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[styles.monthChip, selected && styles.monthChipSelected]}
    >
      <Text style={[styles.monthLabel, selected && styles.monthLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bgBase },
  content: { gap: csSpace.s4, padding: csSpace.s4 },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  monthRow: { flexDirection: 'row', gap: csSpace.s2 },
  monthChip: {
    minHeight: 36,
    paddingHorizontal: csSpace.s3,
    paddingVertical: csSpace.s2,
    borderRadius: csRadius.pill,
    backgroundColor: c.surfaceSunken,
  },
  monthChipSelected: { backgroundColor: c.primary },
  monthLabel: { fontSize: 13, color: c.textPrimary },
  monthLabelSelected: { color: c.textOnPrimary, fontWeight: '600' },
  muted: { fontSize: 13, color: c.textMuted },
  error: { fontSize: 14, color: c.danger, textAlign: 'center' },
  center: { alignItems: 'center', gap: csSpace.s3, paddingVertical: csSpace.s6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  card: { gap: csSpace.s3 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', gap: csSpace.s3, paddingVertical: csSpace.s1 },
  reportAmount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  legend: { gap: csSpace.s2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3 },
  dot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  legendName: { flex: 1, fontSize: 14, color: c.textPrimary, flexShrink: 1 },
  legendAmount: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  });
}
