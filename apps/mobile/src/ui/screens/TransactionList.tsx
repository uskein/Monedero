/**
 * TransactionList (móvil) — BP-04 «Movimientos» (HU-05·06·07).
 * 4 estados: loading (busy) · empty · success (filas) · error (alert + retry).
 * Borrado blando con Deshacer (4 gastos · filtros por tipo + búsqueda.
 * Filas enriquecidas con IDENTIDAD: icono Ionicons por tipo (↑ gasto en
 * sunken · ↓ ingreso en primarySoft · ⇄ transferencia), meta «categoría ·
 * fecha» y monto con color semántico (ingreso primary; NUNCA rojo para un
 * gasto ordinario — SSOT de color). Copy i18n vía useT().
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@monedero/i18n/react';
import type { TranslationKey } from '@monedero/i18n';
import { csRadius, csSpace } from '@monedero/tokens';
import { Button, Input } from '../design-system';
import { useThemeColors } from '../theme';
import type { Transaction, TxType } from '../../core/domain/transaction';
import type { TxListStatus } from '../../state/transactions.store';

const UNDO_MS = 4000;
const TYPES = [null, 'expense', 'income'] as const satisfies ReadonlyArray<TxType | null>;
const TYPE_LABEL: Record<'expense' | 'income', TranslationKey> = {
  expense: 'tx.type.expense',
  income: 'tx.type.income',
};
const TYPE_ICON: Record<TxType, keyof typeof Ionicons.glyphMap> = {
  expense: 'arrow-up',
  income: 'arrow-down',
  transfer: 'swap-horizontal',
};

export interface TransactionListProps {
  status: TxListStatus;
  items: Transaction[];
  error: string | null;
  lastDeletedId: string | null;
  currency: 'COP' | 'USD' | 'EUR';
  categoryNames: Record<string, string>;
  onRetry: () => void;
  onDelete: (id: string) => void;
  onUndo: () => void;
  onClearUndo: () => void;
  onAddFirst: () => void;
}

/** Fecha corta local ('05 oct') segura para 'YYYY-MM-DD' (sin deriva UTC). */
export function shortDate(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat(locale === 'es-CO' ? 'es-CO' : 'en-US', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(y, m - 1, d));
}

export function TransactionList({
  status,
  items,
  error,
  lastDeletedId,
  currency,
  categoryNames,
  onRetry,
  onDelete,
  onUndo,
  onClearUndo,
  onAddFirst,
}: TransactionListProps) {
  const { t, moneySigned, locale } = useI18n();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [filterType, setFilterType] = useState<TxType | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!lastDeletedId) return;
    const timer = setTimeout(onClearUndo, UNDO_MS);
    return () => clearTimeout(timer);
  }, [lastDeletedId, onClearUndo]);

  if (status === 'loading') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.error}>
          {error === 'STORAGE_UNAVAILABLE' ? t('tx.list.error') : t('common.error.generic')}
        </Text>
        <Button label={t('common.retry')} variant="secondary" onPress={onRetry} />
      </View>
    );
  }

  if (status === 'empty') {
    return (
      <View style={styles.center}>
        {lastDeletedId ? <UndoToast label={t('tx.list.undo')} undoLabel={t('tx.list.undo.cta')} onUndo={onUndo} /> : null}
        <Text style={styles.emptyTitle}>{t('tx.list.empty.title')}</Text>
        <Text style={styles.muted}>{t('tx.list.empty.copy')}</Text>
        <Button label={t('tx.list.empty.cta')} onPress={onAddFirst} />
      </View>
    );
  }

  const visible = items.filter((tx) => {
    if (filterType && tx.type !== filterType) return false;
    if (search.trim() !== '') {
      const term = search.trim().toLowerCase();
      const hay = `${tx.payee ?? ''} ${tx.note ?? ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  return (
    <View style={styles.list}>
      <View style={styles.row}>
        {TYPES.map((tt) => (
          <FilterChip
            key={tt ?? 'all'}
            label={tt === null ? t('tx.list.filter.all') : t(TYPE_LABEL[tt])}
            selected={filterType === tt}
            onPress={() => setFilterType(tt)}
          />
        ))}
      </View>

      <Input label={t('tx.list.search')} value={search} onValueChange={setSearch} />

      <Text accessibilityLiveRegion="polite" style={styles.muted}>
        {t('tx.list.count').replace('{count}', String(visible.length))}
      </Text>

      {lastDeletedId ? <UndoToast label={t('tx.list.undo')} undoLabel={t('tx.list.undo.cta')} onUndo={onUndo} /> : null}

      {/* Filas simples (NO FlatList): la pantalla es un ScrollView y anidar
          VirtualizedLists rompe el windowing (aviso de RN). Los datos son
          locales y el virtualizado no aportaba. */}
      {visible.map((item) => {
        const categoryName = item.categoryId
          ? (categoryNames[item.categoryId] ?? item.categoryId)
          : item.type === 'transfer'
            ? t('tx.type.transfer')
            : null;
        const meta = [categoryName, shortDate(item.date, locale)].filter(Boolean).join(' · ');
        return (
          <View key={item.id} style={styles.txRow}>
            <View
              accessibility-hidden="true"
              style={[styles.txIcon, item.type === 'income' && styles.txIconIncome]}
            >
              <Ionicons
                name={TYPE_ICON[item.type]}
                size={20}
                color={item.type === 'income' ? c.primary : c.textPrimary}
              />
            </View>
            <View style={styles.txBody}>
              <Text style={styles.txTitle}>{item.payee ?? t('tx.form.payee')}</Text>
              {meta ? <Text style={styles.muted}>{meta}</Text> : null}
            </View>
            <Text style={[styles.txAmount, item.type === 'income' && styles.income]}>
              {moneySigned(item.amountCents, currency, item.type === 'income')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('common.delete')} ${item.payee ?? t('tx.form.payee')}`}
                onPress={() => onDelete(item.id)}
                style={styles.deleteBtn}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={c.danger} />
              </Pressable>
            </View>
          );
        })}
    </View>
  );
}

function UndoToast({ label, undoLabel, onUndo }: { label: string; undoLabel: string; onUndo: () => void }) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.toast} accessibilityLiveRegion="polite">
      <Text style={styles.toastLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onUndo}>
        <Text style={styles.toastUndo}>{undoLabel}</Text>
      </Pressable>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    list: { gap: csSpace.s3 },
    center: { alignItems: 'center', gap: csSpace.s3, paddingVertical: csSpace.s6 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: csSpace.s2 },
    muted: { fontSize: 12, color: c.textMuted },
    error: { fontSize: 14, color: c.danger, textAlign: 'center' },
    emptyTitle: { fontFamily: 'Fraunces', fontWeight: '700', fontSize: 18, color: c.textPrimary },
    chip: {
      minHeight: 36,
      paddingHorizontal: csSpace.s3,
      paddingVertical: csSpace.s2,
      borderRadius: csRadius.pill,
      backgroundColor: c.surfaceSunken,
    },
    chipSelected: { backgroundColor: c.primary },
    chipLabel: { fontSize: 13, color: c.textPrimary },
    chipLabelSelected: { color: c.textOnPrimary, fontWeight: '600' },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: csSpace.s3,
      paddingVertical: csSpace.s2,
      paddingHorizontal: csSpace.s3,
      marginVertical: csSpace.s1,
      backgroundColor: c.surface,
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
      backgroundColor: c.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txIconIncome: { backgroundColor: c.primarySoft },
    txBody: { flex: 1, gap: 2 },
    txTitle: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    txAmount: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    income: { color: c.primary },
    deleteBtn: { padding: csSpace.s2 },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: csRadius.card,
      padding: csSpace.s3,
    },
    toastLabel: { fontSize: 14, color: c.textPrimary },
    toastUndo: { fontSize: 14, fontWeight: '700', color: c.primary },
  });
}
