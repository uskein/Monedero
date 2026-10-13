/**
 * TransactionsScreen (móvil) — composición BP-04 (lista) + BP-05 (alta).
 * El repo se inyecta (hexagonal): en prod será SQLCipher, en tests/dev sql.js.
 * 4 estados delegados a TransactionList. Trazabilidad: features/transactions → móvil.
 * Categorías: el ALTA usa el store de categorías (seed + PERSONALIZADAS) y la
 * lista resuelve nombre con el mapa dinámico (nunca el id crudo).
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useT } from '@monedero/i18n/react';
import { csSpace } from '@monedero/tokens';
import { Button } from '../design-system';
import { useThemeColors } from '../theme';
import { TransactionForm, type Option } from './TransactionForm';
import { TransactionList } from './TransactionList';
import { CATEGORY_NAMES, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from './catalog';
import { useTransactionsStore } from '../../state/transactions.store';
import { useCategoriesStore, type CategoriesRepo } from '../../state/categories.store';
import type { TransactionRepository } from '../../core/ports/TransactionRepository';
import type { TxInput } from '../../core/domain/transaction';

export interface TransactionsScreenProps {
  repo: TransactionRepository;
  /** Repo de categorías → alta con las personalizadas (HU-10 ⇄ HU-05). */
  categories?: CategoriesRepo;
  currency?: 'COP' | 'USD' | 'EUR';
  /** Señal del CTA del dashboard (BP-03→BP-05): al incrementarse, abre el alta. */
  addSignal?: number;
}

export function TransactionsScreen({ repo, categories, currency = 'COP', addSignal = 0 }: TransactionsScreenProps) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const status = useTransactionsStore((s) => s.status);
  const items = useTransactionsStore((s) => s.items);
  const error = useTransactionsStore((s) => s.error);
  const lastDeletedId = useTransactionsStore((s) => s.lastDeletedId);
  const init = useTransactionsStore((s) => s.init);
  const reload = useTransactionsStore((s) => s.reload);
  const add = useTransactionsStore((s) => s.add);
  const remove = useTransactionsStore((s) => s.remove);
  const undoDelete = useTransactionsStore((s) => s.undoDelete);
  const clearUndo = useTransactionsStore((s) => s.clearUndo);
  /** Categorías de la BD (seed + personalizadas) — init idempotente. */
  const customCategories = useCategoriesStore((s) => s.items);

  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void init(repo);
  }, [init, repo]);

  useEffect(() => {
    if (categories) void useCategoriesStore.getState().init(categories);
  }, [categories]);

  useEffect(() => {
    if (addSignal > 0) setShowForm(true);
  }, [addSignal]);

  /** Opciones del picker: seed + personalizadas (dedup por id, la BD gana). */
  const categoryOptions: Option[] = useMemo(() => {
    const merged = new Map<string, Option>(DEFAULT_CATEGORIES.map((cat) => [cat.id, cat]));
    for (const cat of customCategories) {
      if (!cat.deletedAt) merged.set(cat.id, { id: cat.id, name: cat.name, type: cat.type });
    }
    return [...merged.values()];
  }, [customCategories]);

  /** Nombres para la lista: seed + personalizadas (nunca el id crudo). */
  const categoryNames = useMemo(() => {
    const names: Record<string, string> = { ...CATEGORY_NAMES };
    for (const cat of customCategories) names[cat.id] = cat.name;
    return names;
  }, [customCategories]);

  async function handleSubmit(input: TxInput) {
    const ok = await add(input);
    if (ok) setShowForm(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('tx.list.title')}>
      {showForm ? (
        <View style={styles.formWrap}>
          <TransactionForm
            categories={categoryOptions}
            accounts={DEFAULT_ACCOUNTS}
            currency={currency}
            onSubmit={(input) => void handleSubmit(input)}
          />
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setShowForm(false)} />
        </View>
      ) : status === 'empty' ? null : (
        <Button label={t('tx.form.title')} onPress={() => setShowForm(true)} />
      )}

      {!showForm && (
        <TransactionList
          status={status}
          items={items}
          error={error}
          lastDeletedId={lastDeletedId}
          currency={currency}
          categoryNames={categoryNames}
          onRetry={() => void reload()}
          onDelete={(id) => void remove(id)}
          onUndo={() => void undoDelete()}
          onClearUndo={clearUndo}
          onAddFirst={() => setShowForm(true)}
        />
      )}
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bgBase },
    content: { gap: csSpace.s4, padding: csSpace.s4 },
    formWrap: { gap: csSpace.s2 },
  });
}
