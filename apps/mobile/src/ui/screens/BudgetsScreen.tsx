/**
 * BudgetsScreen (móvil) — BP-06 · HU-11·12. Espejo de la PWA.
 * 4 estados · ProgressBar semántica (80 % accent · 100 % danger) + chip
 * «Meta alcanzada» · toast sereno budget:exceeded de 4000 ms no bloqueante ·
 * F4: slot ocupado → «editar existente». El repo se inyecta (hexagonal).
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@monedero/i18n/react';
import type { CurrencyCode } from '@monedero/i18n';
import { csColors, csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, Input, ProgressBar, Toast } from '../design-system';
import { parseAmountToCents } from '../../core/domain/money';
import { currentPeriod } from '../../core/domain/budget';
import { useBudgetsStore, type BudgetRow, type BudgetsRepo } from '../../state/budgets.store';

export interface BudgetsScreenProps {
  budgets: BudgetsRepo;
  /** Eventos de movimientos → reevaluar uso (F4). */
  txRepo?: { subscribe(cb: (e: { scope: string }) => void): () => void };
  /** Categorías (nombres + picker). */
  categories?: {
    list(opts?: {
      includeArchived?: boolean;
    }): Promise<Array<{ id: string; name: string; type?: string; deletedAt?: string | null }>>;
  };
  /** Periodo por defecto: mes local actual. */
  period?: string;
  /** Moneda de visualización (la de la cuenta; default COP). */
  currency?: CurrencyCode;
}

export function BudgetsScreen({ budgets, txRepo, categories, period, currency = 'COP' }: BudgetsScreenProps) {
  const { t, money } = useI18n();
  const status = useBudgetsStore((s) => s.status);
  const items = useBudgetsStore((s) => s.items);
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
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      const cats = categories ? await categories.list({ includeArchived: true }).catch(() => []) : [];
      setPicker(
        cats.filter((c) => c.type === 'expense' && !c.deletedAt).map(({ id, name }) => ({ id, name })),
      );
      await init({
        budgets,
        period: period ?? currentPeriod(),
        onTxEvent: txRepo ? (cb) => txRepo.subscribe(() => cb()) : undefined,
        loadCategories: async () => cats,
      });
    })();
  }, [categories, budgets, txRepo, period, init]);

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('budgets.title')}>
      <Text style={styles.title}>{t('budgets.title')}</Text>
      <Text style={styles.hint}>
        {`${t('home.period')}: ${t('home.period.current')}`}
      </Text>

      {toast && (
        <Toast
          tone={toast.level === 'exceeded' ? 'error' : 'warn'}
          message={
            toast.level === 'exceeded'
              ? t('budgets.toast.exceeded', {
                  name: toast.categoryName,
                  percent: Math.round(toast.ratio * 100),
                })
              : t('budgets.toast.warn', {
                  name: toast.categoryName,
                  percent: Math.round(toast.ratio * 100),
                })
          }
          onDismiss={clearToast}
        />
      )}

      {status === 'error' ? (
        <View style={styles.gap}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorText}>
            {t('budgets.error')}
          </Text>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void reload()} />
        </View>
      ) : status === 'loading' ? (
        <Text accessibilityLiveRegion="polite" style={styles.copy}>
          {t('common.loading')}
        </Text>
      ) : formOpen ? (
        <Card style={styles.card}>
          {editingCategoryId && (
            <Text style={styles.hint}>
              {t('budgets.editing', {
                name: picker.find((c) => c.id === editingCategoryId)?.name ?? editingCategoryId,
              })}
            </Text>
          )}

          {editingCategoryId ? (
            <Text style={styles.rowName}>
              {picker.find((c) => c.id === editingCategoryId)?.name ?? editingCategoryId}
            </Text>
          ) : (
            <View accessibilityLabel={t('budgets.form.category')} style={styles.chips}>
              {picker.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: categoryId === c.id }}
                  accessibilityLabel={c.name}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.chip, categoryId === c.id && styles.chipSelected]}
                >
                  <Text style={[styles.chipLabel, categoryId === c.id && styles.chipLabelSelected]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Input
            label={t('budgets.form.amount')}
            value={amount}
            onValueChange={setAmount}
            placeholder="0"
            error={amountError ?? undefined}
          />

          {duplicate && (
            <View style={styles.gap}>
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                style={styles.errorText}
              >
                {t('budgets.error.duplicate')}
              </Text>
              <Button
                variant="secondary"
                label={t('budgets.edit')}
                onPress={() => {
                  const row = items.find((i) => i.categoryId === duplicate.categoryId);
                  setEditingCategoryId(duplicate.categoryId);
                  setCategoryId(duplicate.categoryId);
                  setAmount(row ? String(row.budgetCents / 100) : '');
                  clearDuplicate();
                }}
              />
            </View>
          )}

          <Button label={t('budgets.save')} onPress={() => void handleSubmit()} />
          <Button
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => {
              setFormOpen(false);
              setEditingCategoryId(null);
              clearDuplicate();
            }}
          />
        </Card>
      ) : (
        <View style={styles.gap}>
          {status === 'empty' ? (
            <Card style={styles.card}>
              <Text style={styles.emptyTitle}>{t('budgets.empty.title')}</Text>
              <Text style={styles.copy}>{t('budgets.empty.copy')}</Text>
              <Button label={t('budgets.add')} onPress={startCreate} />
            </Card>
          ) : (
            <View style={styles.gap}>
              {items.map((row) => {
                const percent = Math.round(row.ratio * 100);
                return (
                  <Card key={row.budgetId} style={styles.card}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowName}>{row.categoryName}</Text>
                      {row.level === 'exceeded' && (
                        <View accessibilityLabel={t('budgets.chip.exceeded')} style={styles.chipExceeded}>
                          <Text style={styles.chipExceededText}>{t('budgets.chip.exceeded')}</Text>
                        </View>
                      )}
                      <Button
                        variant="ghost"
                        label={`${t('budgets.edit')} ${row.categoryName}`}
                        onPress={() => startEdit(row)}
                      />
                    </View>
                    <ProgressBar percent={row.ratio * 100} label={`${row.categoryName} ${percent} %`} />
                    <Text style={styles.hint}>
                      {`${money(row.spentCents, currency)} ${t('budgets.of')} ${money(row.budgetCents, currency)} · ${percent} %`}
                    </Text>
                  </Card>
                );
              })}
            </View>
          )}
          {status !== 'empty' && (
            <Button variant="secondary" label={t('budgets.add')} onPress={startCreate} />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: csColors.bgBase },
  content: { gap: csSpace.s4, padding: csSpace.s4 },
  title: { fontSize: 20, fontWeight: '700', color: csColors.textPrimary },
  hint: { fontSize: 13, color: csColors.textMuted },
  copy: { fontSize: 14, lineHeight: 22, color: csColors.textMuted },
  card: { gap: csSpace.s3 },
  gap: { gap: csSpace.s3 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: csColors.textPrimary },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s2, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary, flexShrink: 1 },
  chipExceeded: {
    backgroundColor: csColors.danger,
    borderRadius: csRadius.pill,
    paddingHorizontal: csSpace.s3,
    paddingVertical: csSpace.s1,
  },
  chipExceededText: { fontSize: 12, fontWeight: '600', color: csColors.textOnPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: csSpace.s2 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: csSpace.s4,
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
  },
  chipSelected: { backgroundColor: csColors.primary },
  chipLabel: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary },
  chipLabelSelected: { color: csColors.textOnPrimary },
  errorText: { fontSize: 14, color: csColors.danger },
});
