/**
 * TransactionsScreen — composición BP-04 (lista) + BP-05 (alta) bajo el VaultGate.
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS.md → features/transactions.
 * Abre la BD local (sql.js + migraciones) SOLO con bóveda desbloqueada (ADR-003).
 */
import { useEffect, useState } from 'react';
import { Button, Card } from '../../design-system';
import { useT } from '@monedero/i18n/react';
import type { CurrencyCode } from '@monedero/i18n';
import { openDb, resetDbSingleton } from '../../data/db/open';
import { SqlJsTransactionRepository } from '../../data/repo/tx.repo.sqljs';
import { useTransactionsStore, type TransactionsRepo } from './store';
import { TransactionForm } from './TransactionForm';
import { TransactionList } from './TransactionList';
import type { Transaction, TxInput } from '../../data/domain/transactions';

const DEFAULT_CATEGORIES: Array<{ id: string; name: string }> = [
  { id: 'cat-comida', name: 'Comida' },
  { id: 'cat-transporte', name: 'Transporte' },
  { id: 'cat-casa', name: 'Casa' },
  { id: 'cat-salud', name: 'Salud' },
  { id: 'cat-ocio', name: 'Ocio' },
  { id: 'cat-otros', name: 'Otros' },
  { id: 'cat-salario', name: 'Salario' },
  { id: 'cat-ingresos-otros', name: 'Otros ingresos' },
];

const DEFAULT_ACCOUNTS: Array<{ id: string; name: string }> = [
  { id: 'acc-efectivo', name: 'Efectivo' },
];

export interface TransactionsScreenProps {
  currency: CurrencyCode;
  /** Solo tests: repo en memoria para no tocar sql.js en la UI. */
  repoOverride?: TransactionsRepo;
}

export function TransactionsScreen({ currency, repoOverride }: TransactionsScreenProps) {
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
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const repo = repoOverride ?? new SqlJsTransactionRepository(await openDb());
        if (!cancelled) await init(repo);
      } catch {
        if (!cancelled) setBootError('STORAGE_UNAVAILABLE');
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [init, repoOverride]);

  // Limpia la BD singleton al desmontar (solo tests la reabren limpias).
  useEffect(() => () => resetDbSingleton(), []);

  if (bootError) {
    return (
      <div style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
        <p role="alert" style={{ color: 'var(--cs-danger, #B3452F)' }}>
          {t('tx.list.error')}
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const categoryNames: Record<string, string> = Object.fromEntries(
    DEFAULT_CATEGORIES.map((c) => [c.id, c.name]),
  );

  async function handleSubmit(input: TxInput) {
    const ok = await add(input);
    if (ok) setShowForm(false);
  }

  return (
    <section aria-label={t('tx.list.title')} style={{ display: 'grid', gap: 'var(--cs-space-5)' }}>
      {showForm ? (
        <Card>
          <TransactionForm
            categories={DEFAULT_CATEGORIES}
            accounts={DEFAULT_ACCOUNTS}
            currency={currency}
            onSubmit={(input) => void handleSubmit(input)}
          />
          <div style={{ marginTop: 'var(--cs-space-4)' }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      ) : status === 'empty' ? null : (
        <Button variant="primary" onClick={() => setShowForm(true)}>
          {t('tx.form.title')}
        </Button>
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
    </section>
  );
}

export type { Transaction };
