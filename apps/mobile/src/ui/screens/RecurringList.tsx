/**
 * RecurringList (móvil) — tarjeta «Movimientos mensuales» (v0.3.0).
 * Money-critical: la app PROPONE y el usuario pulsa «Generar» — nunca se
 * crean transacciones automáticamente. Cada fila: nombre · día · estado
 * (generado/pausado) + acciones por icono circular (pausar/reanudar
 * neutro · eliminar peligro con confirmación). 4 estados: loading/empty →
 * no se pinta · success (filas) · error (alert role=alert).
 */
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@monedero/i18n/react';
import type { CurrencyCode } from '@monedero/i18n';
import { csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, IconButton } from '../design-system';
import { useThemeColors } from '../theme';
import { isPendingFor } from '../../core/domain/recurrence';
import { todayIso, useRecurrencesStore } from '../../state/recurrences.store';

export interface RecurringListProps {
  categoryNames: Record<string, string>;
}

export function RecurringList({ categoryNames }: RecurringListProps) {
  const { t, money } = useI18n();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const status = useRecurrencesStore((s) => s.status);
  const items = useRecurrencesStore((s) => s.items);
  const error = useRecurrencesStore((s) => s.error);
  const generate = useRecurrencesStore((s) => s.generate);
  const generateAll = useRecurrencesStore((s) => s.generateAll);
  const setActive = useRecurrencesStore((s) => s.setActive);
  const remove = useRecurrencesStore((s) => s.remove);

  if (status === 'loading' || status === 'empty') return null;

  const today = todayIso();
  const period = today.slice(0, 7);
  const pending = items.filter((r) => isPendingFor(r, period, today));
  const bulk = pending.length >= 2;

  function confirmDelete(name: string, id: string) {
    Alert.alert(
      t('tx.recurring.delete.title', { name }),
      t('tx.recurring.delete.copy'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => void remove(id) },
      ],
      { cancelable: true },
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('tx.recurring.title')}</Text>
      <Text style={styles.copy}>{t('tx.recurring.copy')}</Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('tx.recurring.error')}
        </Text>
      ) : null}

      {bulk ? (
        <Button
          label={t('tx.recurring.generateAll').replace('{count}', String(pending.length))}
          onPress={() => void generateAll()}
        />
      ) : null}

      {items.map((rec) => {
        const isPending = isPendingFor(rec, period, today);
        const name =
          rec.payee ??
          (rec.categoryId ? categoryNames[rec.categoryId] : null) ??
          t('tx.recurring.title');
        const metaParts = [
          t('tx.recurring.day').replace('{day}', String(rec.dayOfMonth)),
          rec.lastGeneratedPeriod === period ? t('tx.recurring.generated') : null,
          rec.active ? null : t('tx.recurring.paused'),
        ].filter(Boolean);
        return (
          <View key={rec.id} style={styles.row}>
            <View style={[styles.tile, !rec.active && styles.tilePaused]} accessibility-hidden="true">
              <Ionicons
                name={rec.type === 'income' ? 'arrow-down' : 'repeat'}
                size={18}
                color={rec.active ? c.primary : c.textMuted}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, !rec.active && styles.rowNamePaused]}>{name}</Text>
              <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
            </View>
            <Text style={styles.amount}>{money(rec.amountCents, rec.currency as CurrencyCode)}</Text>
            <View style={styles.actions}>
              {isPending ? (
                <Button
                  variant={bulk ? 'secondary' : 'primary'}
                  label={t('tx.recurring.generate')}
                  onPress={() => void generate(rec.id)}
                />
              ) : null}
              <IconButton
                icon={rec.active ? 'pause' : 'play'}
                tone="neutral"
                label={`${rec.active ? t('tx.recurring.pause') : t('tx.recurring.resume')} ${name}`}
                onPress={() => void setActive(rec.id, !rec.active)}
              />
              <IconButton
                icon="trash-outline"
                tone="danger"
                label={`${t('common.delete')} ${name}`}
                onPress={() => confirmDelete(name, rec.id)}
              />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    card: { gap: csSpace.s3 },
    title: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    copy: { fontSize: 12, color: c.textMuted },
    error: { fontSize: 13, color: c.danger },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: csSpace.s2,
      flexWrap: 'wrap',
      paddingVertical: csSpace.s1,
    },
    tile: {
      width: 40,
      height: 40,
      borderRadius: csRadius.pill,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tilePaused: { backgroundColor: c.surfaceSunken },
    rowBody: { flex: 1, gap: 1, minWidth: 120 },
    rowName: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
    rowNamePaused: { color: c.textMuted },
    meta: { fontSize: 12, color: c.textMuted },
    amount: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s2, marginLeft: 'auto' },
  });
}
