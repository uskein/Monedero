/**
 * TransactionForm (móvil) — BP-05 «Alta de movimiento» (HU-05·06·07).
 * 4 estados: pristine · validando (errores inline) · busy · error.
 * Reglas: importe > 0 en centavos · transfer exige destino distinto y SIN categoría.
 * Estética Clay Serenity: chips de tipo CON icono (↑ gasto / ↓ ingreso ⇄
 * transferencia), MoneyInput con formato EN VIVO (HU-18) y secciones con
 * iconos. Copy i18n vía useT() — cero strings hardcodeados (gate i18n:check).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@monedero/i18n/react';
import { formatAmountLive } from '@monedero/i18n';
import { csColors, csLogo, csRadius, csSpace } from '@monedero/tokens';
import { Button, Input, MoneyInput } from '../design-system';
import { parseAmountToCents } from '../../core/domain/money';
import type { TxInput, TxType } from '../../core/domain/transaction';

export interface Option {
  id: string;
  name: string;
}

export interface TransactionFormProps {
  categories: Option[];
  accounts: Option[];
  currency: 'COP' | 'USD' | 'EUR';
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: TxInput) => void;
}

const TYPES: TxType[] = ['expense', 'income', 'transfer'];
const TYPE_LABEL = { expense: 'tx.type.expense', income: 'tx.type.income', transfer: 'tx.type.transfer' } as const;
const TYPE_ICON = {
  expense: 'arrow-up',
  income: 'arrow-down',
  transfer: 'swap-horizontal',
} as const satisfies Record<TxType, keyof typeof Ionicons.glyphMap>;

export function TransactionForm({ categories, accounts, currency, busy = false, error = null, onSubmit }: TransactionFormProps) {
  const { t, locale } = useI18n();
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState('');
  const [touched, setTouched] = useState(false);

  const cents = parseAmountToCents(amount);
  const amountError =
    touched && cents === null && amount.trim() !== ''
      ? t('tx.form.error.amount.nan')
      : touched && (cents === null || cents <= 0)
        ? t('tx.form.error.amount')
        : undefined;
  const toAccountError =
    touched && type === 'transfer' && (toAccountId === '' || toAccountId === accountId)
      ? t('tx.form.error.toAccount')
      : undefined;

  const visibleCategories =
    type === 'income' ? categories.filter((c) => c.id === 'cat-salario' || c.id === 'cat-ingresos-otros') : categories.filter((c) => c.id !== 'cat-salario' && c.id !== 'cat-ingresos-otros');

  function submit() {
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
    <ScrollView contentContainerStyle={styles.form} accessibilityLabel={t('tx.form.title')}>
      <View style={styles.titleRow}>
        <View style={styles.titleTile} accessibility-hidden="true">
          <Ionicons name="create-outline" size={20} color={csLogo.tileLetter} />
        </View>
        <Text style={styles.title}>{t('tx.form.title')}</Text>
      </View>

      {/* Tipo */}
      <Text style={styles.label}>{t('tx.form.type')}</Text>
      <View style={styles.row}>
        {TYPES.map((tt) => (
          <Chip
            key={tt}
            label={t(TYPE_LABEL[tt])}
            icon={TYPE_ICON[tt]}
            selected={type === tt}
            onPress={() => setType(tt)}
          />
        ))}
      </View>

      <MoneyInput
        label={t('tx.form.amount')}
        value={amount}
        currency={currency}
        onValueChange={(raw) => setAmount(formatAmountLive(raw, currency, locale))}
        error={amountError}
        disabled={busy}
      />
      <Input label={t('tx.form.date')} value={date} onValueChange={setDate} disabled={busy} />
      <Input label={t('tx.form.payee')} value={payee} onValueChange={setPayee} placeholder={t('tx.form.payee.placeholder')} disabled={busy} />

      {type !== 'transfer' && (
        <>
          <Text style={styles.label}>{t('tx.form.category')}</Text>
          <View style={styles.row}>
            {visibleCategories.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>{t('tx.form.account')}</Text>
      <View style={styles.row}>
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </View>

      {type === 'transfer' && (
        <>
          <Text style={styles.label}>{t('tx.form.toAccount')}</Text>
          <View style={styles.row}>
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  a11yLabel={`${t('tx.form.toAccount')}: ${a.name}`}
                  selected={toAccountId === a.id}
                  onPress={() => setToAccountId(a.id)}
                />
              ))}
          </View>
          {toAccountError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {toAccountError}
            </Text>
          ) : null}
        </>
      )}

      <Input label={t('tx.form.note')} value={note} onValueChange={setNote} disabled={busy} />

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {t('common.error.generic')}
        </Text>
      ) : null}

      <Button label={busy ? t('tx.form.busy') : t('tx.form.submit')} onPress={submit} disabled={busy} accessibilityRole="button" />
    </ScrollView>
  );
}

function Chip({
  label,
  a11yLabel,
  icon,
  selected,
  onPress,
}: {
  label: string;
  a11yLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={selected ? csColors.textOnPrimary : csColors.textMuted}
        />
      ) : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: csSpace.s4, padding: csSpace.s4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3 },
  titleTile: {
    width: 36,
    height: 36,
    borderRadius: 36 * csLogo.radiusRatio,
    backgroundColor: csLogo.tileBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: csLogo.font, fontWeight: '700', fontSize: 20, color: csColors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: csColors.textMuted, marginTop: csSpace.s2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: csSpace.s2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: csSpace.s1,
    minHeight: 40,
    paddingHorizontal: csSpace.s3,
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
  },
  chipSelected: { backgroundColor: csColors.primary },
  chipLabel: { fontSize: 14, color: csColors.textPrimary },
  chipLabelSelected: { color: csColors.textOnPrimary, fontWeight: '600' },
  error: { fontSize: 13, color: csColors.danger },
});
