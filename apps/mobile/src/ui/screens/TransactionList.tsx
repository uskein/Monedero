/**
 * TransactionList (móvil) — BP-04 «Movimientos» (HU-05·06·07).
 * 4 estados: loading (busy) · empty · success (filas) · error (alert + retry).
 * Borrado blando con Deshacer (4 s). Filtros por tipo + búsqueda.
 * Copy i18n vía useT() — cero strings hardcodeados (gate i18n:check).
 */
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@monedero/i18n/react';
import type { TranslationKey } from '@monedero/i18n';
import { csColors, csRadius, csSpace } from '@monedero/tokens';
import { Button, Input } from '../design-system';
import type { Transaction, TxType } from '../../core/domain/transaction';
import type { TxListStatus } from '../../state/transactions.store';

const UNDO_MS = 4000;
const TYPES = [null, 'expense', 'income'] as const satisfies ReadonlyArray<TxType | null>;
const TYPE_LABEL: Record<'expense' | 'income', TranslationKey> = {
  expense: 'tx.type.expense',
  income: 'tx.type.income',
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

function typeIcon(type: TxType): string {
  if (type === 'income') return '↑';
  if (type === 'transfer') return '⇄';
  return '↓';
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
  const { t, moneySigned } = useI18n();
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

      <FlatList
        data={visible}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View style={styles.txIcon}>
              <Text>{typeIcon(item.type)}</Text>
            </View>
            <View style={styles.txBody}>
              <Text style={styles.txTitle}>{item.payee ?? t('tx.form.payee')}</Text>
              <Text style={styles.muted}>
                {item.categoryId ? (categoryNames[item.categoryId] ?? item.categoryId) : item.type === 'income' ? t('tx.type.income') : item.type === 'transfer' ? t('tx.type.transfer') : t('tx.type.expense')}
              </Text>
            </View>
            <Text style={[styles.txAmount, item.type === 'income' && styles.income]}>
              {moneySigned(item.amountCents, currency, item.type === 'income')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('common.delete')} ${item.payee ?? t('tx.form.payee')}`}
              onPress={() => onDelete(item.id)}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteLabel}>✕</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

function UndoToast({ label, undoLabel, onUndo }: { label: string; undoLabel: string; onUndo: () => void }) {
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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: csSpace.s3 },
  center: { alignItems: 'center', gap: csSpace.s3, paddingVertical: csSpace.s6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: csSpace.s2 },
  muted: { fontSize: 13, color: csColors.textMuted },
  error: { fontSize: 14, color: csColors.danger, textAlign: 'center' },
  emptyTitle: { fontFamily: 'Fraunces', fontWeight: '700', fontSize: 18, color: csColors.textPrimary },
  chip: {
    minHeight: 36,
    paddingHorizontal: csSpace.s3,
    paddingVertical: csSpace.s2,
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
  },
  chipSelected: { backgroundColor: csColors.primary },
  chipLabel: { fontSize: 13, color: csColors.textPrimary },
  chipLabelSelected: { color: csColors.textOnPrimary, fontWeight: '600' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s2, paddingVertical: csSpace.s3 },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBody: { flex: 1 },
  txTitle: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary },
  txAmount: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary },
  income: { color: csColors.primary },
  deleteBtn: { padding: csSpace.s2 },
  deleteLabel: { fontSize: 16, color: csColors.danger },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: csColors.surface,
    borderRadius: csRadius.card,
    padding: csSpace.s3,
  },
  toastLabel: { fontSize: 14, color: csColors.textPrimary },
  toastUndo: { fontSize: 14, fontWeight: '700', color: csColors.primary },
});
