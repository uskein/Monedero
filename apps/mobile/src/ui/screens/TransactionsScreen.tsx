/**
 * TransactionsScreen (móvil) — composición BP-04 (lista) + BP-05 (alta).
 * El repo se inyecta (hexagonal): en prod será SQLCipher, en tests/dev sql.js.
 * 4 estados delegados a TransactionList. Trazabilidad: features/transactions → móvil.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useT } from '@monedero/i18n/react';
import { csColors, csSpace } from '@monedero/tokens';
import { Button } from '../design-system';
import { TransactionForm } from './TransactionForm';
import { TransactionList } from './TransactionList';
import { CATEGORY_NAMES, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from './catalog';
import { useTransactionsStore } from '../../state/transactions.store';
import type { TransactionRepository } from '../../core/ports/TransactionRepository';
import type { TxInput } from '../../core/domain/transaction';

export interface TransactionsScreenProps {
  repo: TransactionRepository;
  currency?: 'COP' | 'USD' | 'EUR';
}

export function TransactionsScreen({ repo, currency = 'COP' }: TransactionsScreenProps) {
  const t = useT();
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

  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void init(repo);
  }, [init, repo]);

  async function handleSubmit(input: TxInput) {
    const ok = await add(input);
    if (ok) setShowForm(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('tx.list.title')}>
      {showForm ? (
        <View style={styles.formWrap}>
          <TransactionForm
            categories={DEFAULT_CATEGORIES}
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
          categoryNames={CATEGORY_NAMES}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: csColors.bgBase },
  content: { gap: csSpace.s4, padding: csSpace.s4 },
  formWrap: { gap: csSpace.s2 },
});
