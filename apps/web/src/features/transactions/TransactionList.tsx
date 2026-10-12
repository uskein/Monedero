/**
 * TransactionList — BP-04 «Movimientos» (HU-05·06·07).
 * 4 estados: loading (skeleton) · empty (.empty + CTA) · success (filas .tx) · error (toast+retry).
 * Borrado blando con Deshacer (4 s, BP-04 estado success). Filtros: chips tipo + búsqueda.
 * Copy i18n vía useT() — gate i18n:check.
 */
import { useEffect, useState } from 'react';
import { Button, ChipButton, EmptyState, Input, Skeleton, Spinner, Toast, TxRow } from '../../design-system';
import { useI18n } from '@monedero/i18n/react';
import type { CurrencyCode } from '@monedero/i18n';
import type { Transaction, TxType } from '../../data/domain/transactions';
import type { TxListStatus } from './store';

const UNDO_MS = 4000;

export interface TransactionListProps {
  status: TxListStatus;
  items: Transaction[];
  error: string | null;
  lastDeletedId: string | null;
  currency: CurrencyCode;
  onRetry: () => void;
  onDelete: (id: string) => void;
  onUndo: () => void;
  onClearUndo: () => void;
  onAddFirst: () => void;
  /** Mapa id→nombre de categoría para mostrar el nombre legible. */
  categoryNames: Record<string, string>;
}

function categoryIcon(type: TxType): string {
  if (type === 'income') return '↑';
  if (type === 'transfer') return '⇄';
  return '↓';
}

/** Mapa explícito (nunca claves dinámicas: el tipo TranslationKey es unión cerrada). */
const TYPE_LABEL_KEY = {
  income: 'tx.type.income',
  expense: 'tx.type.expense',
  transfer: 'tx.type.transfer',
} as const;

export function TransactionList({
  status,
  items,
  error,
  lastDeletedId,
  currency,
  onRetry,
  onDelete,
  onUndo,
  onClearUndo,
  onAddFirst,
  categoryNames,
}: TransactionListProps) {
  const { t, moneySigned } = useI18n();
  const [filterType, setFilterType] = useState<TxType | null>(null);
  const [search, setSearch] = useState('');

  // Auto-descartar el aviso de Deshacer tras UNDO_MS.
  useEffect(() => {
    if (!lastDeletedId) return;
    const timer = setTimeout(onClearUndo, UNDO_MS);
    return () => clearTimeout(timer);
  }, [lastDeletedId, onClearUndo]);

  if (status === 'loading') {
    return (
      <div aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 'var(--cs-space-3)' }}>
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton height={56} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
        <Toast tone="error">{error === 'STORAGE_UNAVAILABLE' ? t('tx.list.error') : t('common.error.generic')}</Toast>
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
        {lastDeletedId && (
          <Toast tone="success">
            <span style={{ display: 'flex', gap: 'var(--cs-space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('tx.list.undo')}</span>
              <Button variant="ghost" onClick={onUndo}>
                {t('tx.list.undo.cta')}
              </Button>
            </span>
          </Toast>
        )}
        <EmptyState
          icon="🌱"
          title={t('tx.list.empty.title')}
          copy={t('tx.list.empty.copy')}
          action={
            <Button variant="primary" onClick={onAddFirst}>
              {t('tx.list.empty.cta')}
            </Button>
          }
        />
      </div>
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

  const filterOptions: Array<{ value: TxType | null; label: string; tone: 'income' | 'expense' | 'pending' }> = [
    { value: null, label: t('tx.list.filter.all'), tone: 'pending' },
    { value: 'expense', label: t('tx.type.expense'), tone: 'expense' },
    { value: 'income', label: t('tx.type.income'), tone: 'income' },
  ];

  return (
    <div style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cs-space-2)', alignItems: 'center' }}>
        {filterOptions.map((opt) => (
          <ChipButton
            key={opt.label}
            tone={opt.tone}
            aria-pressed={filterType === opt.value}
            onClick={() => setFilterType(opt.value)}
          >
            {opt.label}
          </ChipButton>
        ))}
      </div>

      <Input
        inputId="tx-search"
        type="search"
        value={search}
        placeholder={t('tx.list.search')}
        aria-label={t('tx.list.search')}
        onChange={(e) => setSearch(e.target.value)}
      />

      <p role="status" style={{ color: 'var(--cs-text-muted)', fontSize: 13, margin: 0 }}>
        {t('tx.list.count').replace('{count}', String(visible.length))}
      </p>

      {lastDeletedId && (
        <Toast tone="success">
          <span style={{ display: 'flex', gap: 'var(--cs-space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{t('tx.list.undo')}</span>
            <Button variant="ghost" onClick={onUndo}>
              {t('tx.list.undo.cta')}
            </Button>
          </span>
        </Toast>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--cs-space-2)' }}>
        {visible.map((tx) => (
          <li key={tx.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cs-space-2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TxRow
                  icon={categoryIcon(tx.type)}
                  title={tx.payee ?? t('tx.form.payee')}
                  category={tx.categoryId ? (categoryNames[tx.categoryId] ?? tx.categoryId) : t(TYPE_LABEL_KEY[tx.type])}
                  amount={moneySigned(tx.amountCents, currency, tx.type === 'income')}
                  isIncome={tx.type === 'income'}
                  ariaLabel={`${tx.payee ?? t('tx.form.payee')} — ${moneySigned(tx.amountCents, currency, tx.type === 'income')}`}
                />
              </div>
              <Button
                variant="ghost"
                aria-label={`${t('common.delete')} ${tx.payee ?? t('tx.form.payee')}`}
                onClick={() => onDelete(tx.id)}
              >
                ✕
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Re-export para que la pantalla pueda mostrar spinner mientras init corre. */
export { Spinner };
