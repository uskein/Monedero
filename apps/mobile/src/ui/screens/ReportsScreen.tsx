/**
 * ReportsScreen (móvil) — BP-07 «Reportes» · HU-13. Espejo del plan (PWA en S6+).
 * Donut con paleta SEMÁNTICA de tokens + role=image/label (HU-13) y SIEMPRE
 * tabla alternativa visible (dot + nombre + monto + %): nunca solo color.
 * 4 estados DoD · mes segmentado (Este mes / Mes anterior) · reevalúa ante
 * eventos de movimientos (store). Copy i18n — cero strings hardcodeados.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@monedero/i18n/react';
import { formatMonthLabel, monthKeyOf, previousMonthKey } from '@monedero/i18n';
import type { TranslationKey } from '@monedero/i18n';
import { csLogo, csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, DonutChart } from '../design-system';
import { useThemeColors, type ThemeColors } from '../theme';
import { buildReportHtml, shareReportPdf, shareViewShot } from '../../infrastructure/export/reportExport';
import { ReportSummaryCard } from './ReportSummaryCard';
import { CATEGORY_NAMES } from './catalog';
import { useReportsStore, type ReportsRepo } from '../../state/reports.store';

const TYPE_LABEL: Record<'expense' | 'income' | 'transfer', TranslationKey> = {
  expense: 'tx.type.expense',
  income: 'tx.type.income',
  transfer: 'tx.type.transfer',
};

/** Paleta del donut: SOLO tokens --cs-* de la PALETA ACTIVA (HU-13). */
function donutColors(c: ThemeColors): string[] {
  return [c.primary, c.secondary, c.accent, c.textMuted, c.primarySoft];
}

export interface ReportsScreenProps {
  repo: ReportsRepo;
  currency?: 'COP' | 'USD' | 'EUR';
}

export function ReportsScreen({ repo, currency = 'COP' }: ReportsScreenProps) {
  const { t, money, moneySigned, locale } = useI18n();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const month = useReportsStore((s) => s.month);
  const status = useReportsStore((s) => s.status);
  const report = useReportsStore((s) => s.report);
  const transactions = useReportsStore((s) => s.transactions);
  const init = useReportsStore((s) => s.init);
  const setMonth = useReportsStore((s) => s.setMonth);
  /** Ref de la GEMA de captura (tarjeta oculta), no de la visible. */
  const captureRef = useRef<View>(null);
  const [exporting, setExporting] = useState<'pdf' | 'image' | null>(null);  const [exportError, setExportError] = useState(false);

  useEffect(() => {
    void init(repo);
  }, [init, repo]);

  function categoryText(categoryId: string | null): string {
    return categoryId ? (CATEGORY_NAMES[categoryId] ?? categoryId) : t('reports.uncategorized');
  }

  async function exportPdf() {
    if (!report) return;
    setExporting('pdf');
    setExportError(false);
    try {
      const html = buildReportHtml({
        monthLabel: formatMonthLabel(month, locale),
        tagline: t('home.lead'),
        labels: {
          chart: t('reports.chart'),
          movements: t('reports.export.movements'),
          income: t('home.month.income'),
          expense: t('reports.total'),
          balance: t('home.month.balance'),
          date: t('tx.form.date'),
          payee: t('tx.form.payee'),
          category: t('tx.form.category'),
          type: t('tx.form.type'),
          amount: t('tx.form.amount'),
        },
        incomeText: money(report.incomeCents, currency),
        expenseText: money(report.expenseCents, currency),
        balanceText: money(report.balanceCents, currency),
        reportMax: {
          income: report.incomeCents,
          expense: report.expenseCents,
          max: Math.max(report.incomeCents, report.expenseCents, 1),
        },
        categories: report.byCategory.map((cat, i) => ({
          name: categoryText(cat.categoryId),
          amountText: money(cat.amountCents, currency),
          percent: cat.percent,
          color: donutColors(c)[i % donutColors(c).length] ?? c.primary,
        })),
        transactions: transactions.map((tx) => ({
          dateText: tx.date,
          payee: tx.payee ?? t('tx.form.payee'),
          category: categoryText(tx.categoryId),
          typeLabel: t(TYPE_LABEL[tx.type]),
          amountText: moneySigned(tx.amountCents, currency, tx.type === 'income'),
          kind: tx.type,
        })),
        colors: {
          bgBase: c.bgBase,
          surface: c.surface,
          surfaceSunken: c.surfaceSunken,
          primary: c.primary,
          primarySoft: c.primarySoft,
          accent: c.accent,
          secondary: c.secondary,
          textPrimary: c.textPrimary,
          textMuted: c.textMuted,
          danger: c.danger,
          textOnPrimary: c.textOnPrimary,
          tileBg: csLogo.tileBg,
          tileLetter: csLogo.tileLetter,
          tileFont: csLogo.font,
        },
      });
      await shareReportPdf(html);
    } catch (err) {
      if (__DEV__) console.warn('[monedero] export pdf falló', err);
      setExportError(true);
    } finally {
      setExporting(null);
    }
  }

  async function exportImage() {
    if (!report || !captureRef.current) return;
    setExporting('image');
    setExportError(false);
    try {
      await shareViewShot(captureRef.current);
    } catch (err) {
      if (__DEV__) console.warn('[monedero] export image falló', err);
      setExportError(true);
    } finally {
      setExporting(null);
    }
  }

  const currentMonth = monthKeyOf(new Date());
  const previousMonth = previousMonthKey(currentMonth);

  // Tarjeta-resumen (HU-13): visible en pantalla + gemela OCULTA maquetada
  // fuera del ScrollView para la captura (en Fabric, snapshotear la tarjeta
  // dentro del ScrollView sale en blanco; fuera de pantalla se dibuja bien).
  const summaryCard = report ? (
    <ReportSummaryCard
      monthLabel={formatMonthLabel(month, locale)}
      incomeText={money(report.incomeCents, currency)}
      expenseText={money(report.expenseCents, currency)}
      balanceText={money(report.balanceCents, currency)}
      compare={{
        income: report.incomeCents,
        expense: report.expenseCents,
        max: Math.max(report.incomeCents, report.expenseCents, 1),
      }}
      categories={report.byCategory.slice(0, 5).map((cat, i) => ({
        name: categoryText(cat.categoryId),
        percent: cat.percent,
        color: donutColors(c)[i % donutColors(c).length] ?? c.primary,
      }))}
    />
  ) : null;

  return (
    <View style={styles.screen}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} accessibilityLabel={t('reports.title')}>
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
          {/* Tarjeta-resumen con IDENTIDAD (HU-13) — misma vista que la imagen exportada */}
          {summaryCard}

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

          {/* Exportación (HU-13): PDF con todo el mes + imagen de la tarjeta */}
          <View style={styles.exportRow}>
            <Button
              variant="secondary"
              label={exporting === 'pdf' ? t('reports.export.generating') : t('reports.export.pdf')}
              disabled={exporting !== null}
              onPress={() => void exportPdf()}
            />
            <Button
              variant="secondary"
              label={exporting === 'image' ? t('reports.export.generating') : t('reports.export.image')}
              disabled={exporting !== null}
              onPress={() => void exportImage()}
            />
          </View>
          {exportError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {t('reports.export.error')}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>

      {/* Gema de captura: gemela de la tarjeta visible, maquetada FUERA de
          pantalla pero dibujada (el ScrollView rompe la captura en Fabric).
          Oculta para lectores y sin eventos táctiles. */}
      <View
        style={styles.captureHost}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View ref={captureRef} collapsable={false}>
          {summaryCard}
        </View>
      </View>
    </View>
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
  scroll: { flex: 1 },
  // Fuera de pantalla pero MAQUETADA: el bitmap de captura dibuja este
  // subárbol completo (en el ScrollView, Fabric captura en blanco).
  captureHost: { position: 'absolute', left: -10000, top: 0, width: 380 },
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
  exportRow: { flexDirection: 'row', gap: csSpace.s3, flexWrap: 'wrap' },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', gap: csSpace.s3, paddingVertical: csSpace.s1 },
  reportAmount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  legend: { gap: csSpace.s2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3 },
  dot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  legendName: { flex: 1, fontSize: 14, color: c.textPrimary, flexShrink: 1 },
  legendAmount: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  });
}
