/**
 * ReportSummaryCard — tarjeta-resumen con IDENTIDAD (HU-13) que se exporta
 * como IMAGEN (react-native-view-shot) y resume el mes: ingresos · total de
 * gastos · balance + barras comparativas. Temática (HU-17); colores solo
 * tokens. El contenedor se expone vía viewRef para la captura.
 */
import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@monedero/i18n/react';
import { csLogo, csRadius, csSpace } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export interface SummaryBar {
  name: string;
  percent: number;
  color: string;
}

export interface ReportSummaryCardProps {
  monthLabel: string;
  incomeText: string;
  expenseText: string;
  balanceText: string;
  /** Centavos para la barra comparativa ingresos vs gastos. */
  compare: { income: number; expense: number; max: number };
  categories: SummaryBar[];
}

export const ReportSummaryCard = forwardRef<View, ReportSummaryCardProps>(function ReportSummaryCard(
  { monthLabel, incomeText, expenseText, balanceText, compare, categories },
  ref,
) {
  const { t } = useI18n();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const compareMax = Math.max(compare.max, 1);

  return (
    <View ref={ref} style={styles.card} accessibilityLabel={`${t('app.name')} · ${monthLabel}`}>
      <View style={styles.head}>
        <View style={styles.tile} accessibility-hidden="true">
          <Text style={styles.tileLetter}>M</Text>
        </View>
        <View style={styles.gap4}>
          <Text style={styles.brand}>{t('app.name')}</Text>
          <Text style={styles.month}>{monthLabel}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('home.month.income')}</Text>
          <Text style={[styles.statValue, styles.income]}>{incomeText}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('reports.total')}</Text>
          <Text style={[styles.statValue, styles.expense]}>{expenseText}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('home.month.balance')}</Text>
          <Text style={[styles.statValue, styles.balance]}>{balanceText}</Text>
        </View>
      </View>

      <View accessibilityRole="progressbar" accessibilityLabel={t('home.month.income')} style={styles.track}>
        <View style={[styles.fill, { width: `${(compare.income / compareMax) * 100}%`, backgroundColor: c.primary }]} />
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel={t('reports.total')} style={styles.track}>
        <View style={[styles.fill, { width: `${(compare.expense / compareMax) * 100}%`, backgroundColor: c.accent }]} />
      </View>

      {categories.length > 0 ? (
        <View style={styles.gap4}>
          {categories.map((cat) => (
            <View key={cat.name} style={styles.catRow}>
              <View accessibility-hidden="true" style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={styles.catName} numberOfLines={1}>
                {cat.name}
              </Text>
              <Text style={styles.catPercent}>{`${Math.round(cat.percent)} %`}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: csRadius.card,
      padding: csSpace.s5,
      gap: csSpace.s3,
      borderWidth: 1,
      borderColor: c.surfaceSunken,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3 },
    gap4: { gap: 4, flexShrink: 1 },
    tile: {
      width: 40,
      height: 40,
      borderRadius: 40 * csLogo.radiusRatio,
      backgroundColor: csLogo.tileBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLetter: { color: csLogo.tileLetter, fontFamily: csLogo.font, fontWeight: '700', fontSize: 22 },
    brand: { fontFamily: csLogo.font, fontSize: 17, fontWeight: '700', color: c.textPrimary },
    month: { fontSize: 12, color: c.textMuted },
    stats: { flexDirection: 'row', gap: csSpace.s2 },
    stat: {
      flex: 1,
      backgroundColor: c.bgBase,
      borderRadius: csRadius.input,
      padding: csSpace.s3,
      gap: 2,
    },
    statLabel: { fontSize: 11, color: c.textMuted },
    statValue: { fontSize: 15, fontWeight: '700' },
    income: { color: c.primary },
    expense: { color: c.accent },
    balance: { color: c.secondary },
    track: { height: 10, borderRadius: csRadius.pill, backgroundColor: c.surfaceSunken, overflow: 'hidden' },
    fill: { height: 10, borderRadius: csRadius.pill },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s2 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    catName: { flex: 1, fontSize: 13, color: c.textPrimary },
    catPercent: { fontSize: 12, color: c.textMuted },
  });
}
