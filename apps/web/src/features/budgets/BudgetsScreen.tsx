/**
 * BudgetsScreen — BP-06 (Presupuestos) bajo el VaultGate · HU-11·12.
 * 4 estados · barra semántica Progress (80 % accent · 100 % danger + chip
 * «Meta alcanzada») · toast sereno budget:exceeded de 4000 ms no bloqueante ·
 * F4: slot ocupado → «editar existente». Trazabilidad: features/budgets.
 */
import { useEffect, useState } from 'react';
import { csColors } from '@monedero/tokens';
import { useI18n, symbolFor } from '@monedero/i18n/react';
import { parseAmountToCents } from '@monedero/i18n';
import type { CurrencyCode } from '@monedero/i18n';
import {
  Button,
  Card,
  EmptyState,
  MoneyInput,
  Progress,
  Spinner,
  Toast,
} from '../../design-system';
import { getBudgetsRepo, getCategoriesRepo, getTxRepo } from '../../data/db/session';
import { useBudgetsStore, type BudgetRow, type BudgetsRepo } from './store';

export interface BudgetsScreenProps {
  currency: CurrencyCode;
  /** Solo tests: repo en memoria para no tocar sql.js en la UI. */
  repoOverride?: BudgetsRepo;
  /** Solo tests: categorías (nombres + picker) sin tocar sql.js. */
  categoriesOverride?: () => Promise<
    Array<{ id: string; name: string; type?: string; deletedAt?: string | null }>
  >;
  /** Solo tests: suscripción a cambios de movimientos. */
  txEventsOverride?: (cb: () => void) => () => void;
}

export function BudgetsScreen({
  currency,
  repoOverride,
  categoriesOverride,
  txEventsOverride,
}: BudgetsScreenProps) {
  const { t, money } = useI18n();
  const status = useBudgetsStore((s) => s.status);
  const items = useBudgetsStore((s) => s.items);
  const error = useBudgetsStore((s) => s.error);
  const duplicate = useBudgetsStore((s) => s.duplicate);
  const toast = useBudgetsStore((s) => s.toast);
  const init = useBudgetsStore((s) => s.init);
  const reload = useBudgetsStore((s) => s.reload);
  const save = useBudgetsStore((s) => s.save);
  const clearToast = useBudgetsStore((s) => s.clearToast);
  const clearDuplicate = useBudgetsStore((s) => s.clearDuplicate);

  const [picker, setPicker] = useState<Array<{ id: string; name: string }>>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [bootError, setBootError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        if (repoOverride) {
          const cats = categoriesOverride ? await categoriesOverride() : [];
          if (cancelled) return;
          setPicker(cats.filter((c) => c.type === 'expense' && !c.deletedAt).map(({ id, name }) => ({ id, name })));
          await init({
            budgets: repoOverride,
            loadCategories: async () => cats,
            onTxEvent: txEventsOverride,
          });
          return;
        }
        const [budgetsRepo, txRepo, categoriesRepo] = await Promise.all([
          getBudgetsRepo(),
          getTxRepo(),
          getCategoriesRepo(),
        ]);
        if (cancelled) return;
        const cats = await categoriesRepo.list({ includeArchived: true });
        if (cancelled) return;
        setPicker(cats.filter((c) => c.type === 'expense' && !c.deletedAt).map(({ id, name }) => ({ id, name })));
        await init({
          budgets: budgetsRepo,
          onTxEvent: (cb) =>
            txRepo.subscribe((e) => {
              if (e.scope === 'tx') cb();
            }),
          loadCategories: async () => cats,
        });
      } catch {
        if (!cancelled) setBootError(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [init, repoOverride, categoriesOverride, txEventsOverride]);

  // Toast sereno auto-cerrable (4000 ms, HU-12); nunca bloquea la UI.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => clearToast(), 4000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  function startCreate() {
    clearDuplicate();
    setFormOpen(true);
    setEditingCategoryId(null);
    setCategoryId(picker[0]?.id ?? '');
    setAmount('');
    setAmountError(null);
  }

  function startEdit(row: BudgetRow) {
    clearDuplicate();
    setFormOpen(true);
    setEditingCategoryId(row.categoryId);
    setCategoryId(row.categoryId);
    setAmount(String(row.budgetCents / 100));
    setAmountError(null);
  }

  async function handleSubmit() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) {
      setAmountError(t('budgets.error.amount'));
      return;
    }
    setAmountError(null);
    const ok = await save(
      { categoryId, amountCents: cents },
      editingCategoryId ? { editingCategoryId } : undefined,
    );
    if (ok) {
      setFormOpen(false);
      setEditingCategoryId(null);
    }
  }

  const showError = bootError || status === 'error';

  return (
    <section aria-label={t('budgets.title')} style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('budgets.title')}</h2>
      <p style={{ margin: 0, fontSize: 13, color: csColors.textMuted }}>
        {t('home.period')}: {t('home.period.current')}
      </p>

      {toast && (
        <Toast tone={toast.level === 'exceeded' ? 'error' : 'warn'}>
          {toast.level === 'exceeded'
            ? t('budgets.toast.exceeded', {
                name: toast.categoryName,
                percent: Math.round(toast.ratio * 100),
              })
            : t('budgets.toast.warn', {
                name: toast.categoryName,
                percent: Math.round(toast.ratio * 100),
              })}
        </Toast>
      )}

      {showError ? (
        <div style={{ display: 'grid', gap: 'var(--cs-space-3)' }}>
          <p role="alert" style={{ color: csColors.danger, margin: 0 }}>
            {error === null ? t('common.error.generic') : t('budgets.error')}
          </p>
          <Button variant="secondary" onClick={() => void reload()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : status === 'loading' ? (
        <Spinner label={t('common.loading')} />
      ) : formOpen ? (
        <Card style={{ display: 'grid', gap: 'var(--cs-space-4)', textAlign: 'left' }}>
          {editingCategoryId && (
            <p style={{ margin: 0, fontSize: 13, color: csColors.textMuted }}>
              {t('budgets.editing', {
                name: picker.find((c) => c.id === editingCategoryId)?.name ?? editingCategoryId,
              })}
            </p>
          )}

          <div className="ds-field">
            <label className="ds-label" htmlFor="budget-category">
              {t('budgets.form.category')}
            </label>
            <select
              id="budget-category"
              value={categoryId}
              disabled={Boolean(editingCategoryId)}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{
                minHeight: 48,
                borderRadius: 18,
                border: 'none',
                boxShadow: '0 6px 18px rgba(60,50,40,0.10)',
                padding: '0 var(--cs-space-3)',
                fontSize: 16,
                background: csColors.surface,
                color: csColors.textPrimary,
              }}
            >
              {picker.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <MoneyInput
            label={t('budgets.form.amount')}
            currencySymbol={symbolFor(currency)}
            value={amount}
            onValueChange={setAmount}
            error={amountError ?? undefined}
          />

          {duplicate ? (
            <div role="alert" style={{ display: 'grid', gap: 'var(--cs-space-2)' }}>
              <p style={{ margin: 0, color: csColors.danger }}>{t('budgets.error.duplicate')}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  const row = items.find((i) => i.categoryId === duplicate.categoryId);
                  setEditingCategoryId(duplicate.categoryId);
                  setCategoryId(duplicate.categoryId);
                  setAmount(row ? String(row.budgetCents / 100) : '');
                  clearDuplicate();
                }}
              >
                {t('budgets.edit')}
              </Button>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 'var(--cs-space-3)' }}>
            <Button variant="primary" onClick={() => void handleSubmit()}>
              {t('budgets.save')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFormOpen(false);
                setEditingCategoryId(null);
                clearDuplicate();
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {status === 'empty' ? (
            <EmptyState
              title={t('budgets.empty.title')}
              copy={t('budgets.empty.copy')}
              action={
                <Button variant="primary" onClick={startCreate}>
                  {t('budgets.add')}
                </Button>
              }
            />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--cs-space-4)' }}>
              {items.map((row) => (
                <li key={row.budgetId}>
                  <Card style={{ display: 'grid', gap: 'var(--cs-space-3)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cs-space-3)' }}>
                      <span style={{ flex: 1, fontWeight: 600 }}>{row.categoryName}</span>
                      {row.level === 'exceeded' && (
                        <span
                          style={{
                            background: csColors.danger,
                            color: csColors.textOnPrimary,
                            borderRadius: 999,
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {t('budgets.chip.exceeded')}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => startEdit(row)}
                        aria-label={`${t('budgets.edit')} ${row.categoryName}`}
                      >
                        {t('budgets.edit')}
                      </Button>
                    </div>
                    <Progress
                      percent={row.ratio * 100}
                      label={`${row.categoryName} ${Math.round(row.ratio * 100)} %`}
                    />
                    <p style={{ margin: 0, fontSize: 13, color: csColors.textMuted }}>
                      {`${money(row.spentCents, currency)} ${t('budgets.of')} ${money(row.budgetCents, currency)} · ${Math.round(row.ratio * 100)} %`}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {status !== 'empty' && (
            <Button variant="secondary" onClick={startCreate}>
              {t('budgets.add')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
