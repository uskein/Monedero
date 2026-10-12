/**
 * TransactionForm — BP-05 «Alta de movimiento» (HU-05·06·07).
 * Composición SSOT: MoneyInput + Input + Segmented(tipo) + Chip(categoría) + Button.
 * 4 estados: pristine (CTA disabled) · validando (errors inline) · busy (spinner) · error (toast).
 * Reglas: importe > 0 en centavos · transfer exige destino distinto y SIN categoría.
 * Copy i18n vía useT() — gate i18n:check (cero strings hardcodeados).
 */
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, MoneyInput, Segmented, Toast } from '../../design-system';
import { useI18n, symbolFor } from '@monedero/i18n/react';
import type { CurrencyCode } from '@monedero/i18n';
import type { TxInput, TxType } from '../../data/domain/transactions';

export interface CategoryOption {
  id: string;
  name: string;
}

export interface AccountOption {
  id: string;
  name: string;
}

export interface TransactionFormProps {
  categories: CategoryOption[];
  accounts: AccountOption[];
  currency: CurrencyCode;
  busy?: boolean;
  /** DomainErrorCode | null mostrado como toast de error (BP-05 estado error). */
  error?: string | null;
  onSubmit: (input: TxInput) => void;
}

/** Convierte "18.500,50" / "18,500.50" a centavos enteros; null si es inválido. */
export function parseAmountToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s/g, '');
  // Si tiene dos separadores, el último es decimal; si uno solo, decidimos por dígitos tras él.
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  let decimalSep = -1;
  if (lastComma >= 0 && lastDot >= 0) decimalSep = Math.max(lastComma, lastDot);
  else if (lastComma >= 0 || lastDot >= 0) {
    const sep = Math.max(lastComma, lastDot);
    const digitsAfter = normalized.length - sep - 1;
    // Regla móvil (money.ts): 1–2 dígitos tras el ÚLTIMO separador ⇒ decimal; 3+ ⇒ miles.
    decimalSep = digitsAfter >= 1 && digitsAfter <= 2 ? sep : -1;
  }
  let major: string;
  let minor = '';
  if (decimalSep >= 0) {
    major = normalized.slice(0, decimalSep).replace(/[.,]/g, '');
    minor = normalized.slice(decimalSep + 1);
  } else {
    major = normalized.replace(/[.,]/g, '');
  }
  if (!/^\d*$/.test(major) || !/^\d*$/.test(minor)) return null;
  if (major === '' && minor === '') return null;
  const cents = Number(major || '0') * 100 + Number((minor + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function TransactionForm({
  categories,
  accounts,
  currency,
  busy = false,
  error = null,
  onSubmit,
}: TransactionFormProps) {
  const { t } = useI18n();
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [touched, setTouched] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const cents = parseAmountToCents(amount);
  const amountError =
    touched && amount.trim() !== '' && cents === null
      ? t('tx.form.error.amount.nan')
      : touched && (cents === null || cents <= 0)
        ? t('tx.form.error.amount')
        : undefined;
  const toAccountError =
    touched && type === 'transfer' && (toAccountId === '' || toAccountId === accountId)
      ? t('tx.form.error.toAccount')
      : undefined;

  const typeOptions = [
    { value: 'expense' as const, label: t('tx.type.expense') },
    { value: 'income' as const, label: t('tx.type.income') },
    { value: 'transfer' as const, label: t('tx.type.transfer') },
  ];

  const visibleCategories =
    type === 'income'
      ? categories.filter((c) => c.id.startsWith('cat-') && (c.id === 'cat-salario' || c.id === 'cat-ingresos-otros'))
      : categories.filter((c) => c.id !== 'cat-salario' && c.id !== 'cat-ingresos-otros');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (cents === null || cents <= 0) return;
    if (type === 'transfer' && (toAccountId === '' || toAccountId === accountId)) return;
    onSubmit({
      type,
      amountCents: cents,
      currency,
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? null : categoryId,
      payee: payee.trim() === '' ? undefined : payee.trim(),
      note: note.trim() === '' ? undefined : note.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label={t('tx.form.title')}>
      <h2
        style={{
          fontFamily: 'var(--cs-font-display)',
          fontWeight: 700,
          fontSize: 20,
          margin: '0 0 var(--cs-space-4)',
        }}
      >
        {t('tx.form.title')}
      </h2>

      <div style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
        <Segmented
          label={t('tx.form.type')}
          options={typeOptions}
          value={type}
          onChange={(next) => {
            setType(next);
            if (next !== 'transfer') setToAccountId('');
          }}
        />

        <MoneyInput
          label={t('tx.form.amount')}
          currencySymbol={symbolFor(currency)}
          value={amount}
          onValueChange={setAmount}
          error={amountError}
          disabled={busy}
        />

        <Field label={t('tx.form.date')}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              inputId={inputId}
              describedBy={describedBy}
              invalid={invalid}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
            />
          )}
        </Field>

        <Field label={t('tx.form.payee')}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              inputId={inputId}
              describedBy={describedBy}
              invalid={invalid}
              value={payee}
              placeholder={t('tx.form.payee.placeholder')}
              onChange={(e) => setPayee(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
          )}
        </Field>

        {type !== 'transfer' && (
          <Field label={t('tx.form.category')}>
            {({ inputId }) => (
              <select
                id={inputId}
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value === '' ? null : e.target.value)}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--cs-radius-md)',
                  border: '1px solid var(--cs-border)',
                  background: 'var(--cs-surface)',
                  color: 'inherit',
                  fontSize: 15,
                }}
              >
                <option value="">{t('tx.form.category')}</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {type !== 'transfer' ? (
          <Field label={t('tx.form.account')}>
            {({ inputId }) => (
              <select
                id={inputId}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--cs-radius-md)',
                  border: '1px solid var(--cs-border)',
                  background: 'var(--cs-surface)',
                  color: 'inherit',
                  fontSize: 15,
                }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : (
          <>
            <Field label={t('tx.form.account')}>
              {({ inputId }) => (
                <select
                  id={inputId}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={busy}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--cs-radius-md)',
                    border: '1px solid var(--cs-border)',
                    background: 'var(--cs-surface)',
                    color: 'inherit',
                    fontSize: 15,
                  }}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('tx.form.toAccount')} error={toAccountError}>
              {({ inputId, describedBy, invalid }) => (
                <select
                  id={inputId}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  disabled={busy}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--cs-radius-md)',
                    border: '1px solid var(--cs-border)',
                    background: 'var(--cs-surface)',
                    color: 'inherit',
                    fontSize: 15,
                  }}
                >
                  <option value="">{t('tx.form.toAccount')}</option>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              )}
            </Field>
          </>
        )}

        <Field label={t('tx.form.note')}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              inputId={inputId}
              describedBy={describedBy}
              invalid={invalid}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              disabled={busy}
            />
          )}
        </Field>

        {error && <Toast tone="error">{t('common.error.generic')}</Toast>}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? t('tx.form.busy') : t('tx.form.submit')}
        </Button>
      </div>
    </form>
  );
}
