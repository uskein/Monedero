/**
 * SettingsScreen (móvil) — BP-08 (raíz de Ajustes) + sub Categorías (HU-10).
 * Espejo de la PWA (features/settings). S5: el hub vive con la única sección
 * funcional «Categorías»; seguridad/datos/apariencia llegan en S6/S7.
 * 4 estados: loading | empty | success | error. Color restringido a tokens.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '@monedero/i18n/react';
import { csColors, csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, Input } from '../design-system';
import { useCategoriesStore, type CategoriesRepo } from '../../state/categories.store';
import type { Category, CategoryType } from '../../core/domain/category';

/** Paleta restringida a tokens --cs-* (criterio HU-10). */
export const CATEGORY_SWATCHES = [
  { token: 'primary', color: csColors.primary },
  { token: 'secondary', color: csColors.secondary },
  { token: 'accent', color: csColors.accent },
  { token: 'danger', color: csColors.danger },
] as const;

export type SwatchToken = (typeof CATEGORY_SWATCHES)[number]['token'];

/** Color de la fila: SOLO valores token (si el dato no coincide, sunken). */
export function swatchColorFor(categoryColor: string): string {
  return CATEGORY_SWATCHES.find((s) => s.color === categoryColor)?.color ?? csColors.surfaceSunken;
}

export interface SettingsScreenProps {
  categories: CategoriesRepo;
}

export function SettingsScreen({ categories }: SettingsScreenProps) {
  const t = useT();
  const [view, setView] = useState<'hub' | 'categories'>('hub');

  if (view === 'categories') {
    return <CategoriesManager repo={categories} onBack={() => setView('hub')} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('settings.title')}>
      <Text style={styles.title}>{t('settings.title')}</Text>
      <Card style={styles.card}>
        <Text style={styles.copy}>{t('settings.subtitle')}</Text>
        <Button variant="secondary" label={t('settings.categories')} onPress={() => setView('categories')} />
        <Text style={styles.hint}>{t('settings.categories.copy')}</Text>
      </Card>
    </ScrollView>
  );
}

/** Type chips (Gasto/Ingreso) con rol radio — espejo del Segmented de la PWA. */
function TypeChips({ value, onChange }: { value: CategoryType; onChange: (v: CategoryType) => void }) {
  const t = useT();
  return (
    <View accessibilityLabel={t('categories.form.type')} style={styles.chips}>
      {(
        [
          { v: 'expense' as const, label: t('tx.type.expense') },
          { v: 'income' as const, label: t('tx.type.income') },
        ]
      ).map((opt) => (
        <Pressable
          key={opt.v}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === opt.v }}
          onPress={() => onChange(opt.v)}
          style={[styles.chip, value === opt.v && styles.chipSelected]}
        >
          <Text style={[styles.chipLabel, value === opt.v && styles.chipLabelSelected]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Selector de color (radiogroup) — SOLO swatches de tokens --cs-*. */
function SwatchPicker({ value, onPick }: { value: SwatchToken; onPick: (v: SwatchToken) => void }) {
  const t = useT();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('categories.form.color')} style={styles.swatches}>
      {CATEGORY_SWATCHES.map((s) => (
        <Pressable
          key={s.token}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === s.token }}
          accessibilityLabel={s.token}
          onPress={() => onPick(s.token)}
          style={[
            styles.swatch,
            { backgroundColor: s.color },
            value === s.token && styles.swatchSelected,
          ]}
        />
      ))}
    </View>
  );
}

export function CategoriesManager({ repo, onBack }: { repo: CategoriesRepo; onBack: () => void }) {
  const t = useT();
  const status = useCategoriesStore((s) => s.status);
  const items = useCategoriesStore((s) => s.items);
  const formError = useCategoriesStore((s) => s.formError);
  const init = useCategoriesStore((s) => s.init);
  const reload = useCategoriesStore((s) => s.reload);
  const create = useCategoriesStore((s) => s.create);
  const update = useCategoriesStore((s) => s.update);
  const archive = useCategoriesStore((s) => s.archive);
  const remove = useCategoriesStore((s) => s.remove);
  const clearFormError = useCategoriesStore((s) => s.clearFormError);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [swatch, setSwatch] = useState<SwatchToken>('primary');
  const [colorDirty, setColorDirty] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [removeFailed, setRemoveFailed] = useState(false);

  useEffect(() => {
    void init(repo);
  }, [init, repo]);

  function startCreate() {
    clearFormError();
    setRemoveFailed(false);
    setMode('create');
    setEditing(null);
    setName('');
    setType('expense');
    setSwatch('primary');
    setColorDirty(false);
    setNameError(null);
  }

  function startEdit(category: Category) {
    clearFormError();
    setRemoveFailed(false);
    setMode('edit');
    setEditing(category);
    setName(category.name);
    setType(category.type);
    const match = CATEGORY_SWATCHES.find((s) => s.color === category.color);
    setSwatch(match?.token ?? 'primary');
    setColorDirty(false);
    setNameError(null);
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      setNameError(t('categories.error.name'));
      return;
    }
    setNameError(null);
    const color = CATEGORY_SWATCHES.find((s) => s.token === swatch)?.color;
    const ok =
      mode === 'edit' && editing
        ? await update(editing.id, colorDirty ? { name: trimmed, color } : { name: trimmed })
        : await create({ name: trimmed, type, color });
    if (ok) {
      setMode('list');
      setEditing(null);
    }
  }

  const formErrorMessage =
    formError === 'INTEGRITY_VIOLATION'
      ? t('categories.error.duplicate')
      : formError === 'VALIDATION_FAILED'
        ? t('categories.error.name')
        : null;

  const showForm = mode === 'create' || mode === 'edit';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('categories.title')}>
      <View style={styles.header}>
        <Button variant="ghost" label={t('common.back')} onPress={onBack} />
        <Text style={styles.title}>{t('categories.title')}</Text>
      </View>

      {status === 'error' ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>
            {t('categories.error')}
          </Text>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void reload()} />
        </View>
      ) : status === 'loading' ? (
        <Text accessibilityLiveRegion="polite" style={styles.copy}>
          {t('common.loading')}
        </Text>
      ) : showForm ? (
        <Card style={styles.card}>
          <Input
            label={t('categories.form.name')}
            value={name}
            onValueChange={setName}
            placeholder={t('categories.form.name.placeholder')}
            error={nameError ?? undefined}
          />
          {mode === 'create' && <TypeChips value={type} onChange={setType} />}
          <SwatchPicker value={swatch} onPick={(v) => {
            setSwatch(v);
            setColorDirty(true);
          }} />
          {formErrorMessage && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorText}>
              {formErrorMessage}
            </Text>
          )}
          <Button label={t('categories.save')} onPress={() => void handleSubmit()} />
          <Button
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => {
              setMode('list');
              setEditing(null);
              clearFormError();
            }}
          />
        </Card>
      ) : (
        <View style={styles.cardGap}>
          {removeFailed && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorText}>
              {t('categories.error.delete')}
            </Text>
          )}
          {status === 'empty' ? (
            <Card style={styles.card}>
              <Text style={styles.emptyTitle}>{t('categories.empty.title')}</Text>
              <Text style={styles.copy}>{t('categories.empty.copy')}</Text>
              <Button label={t('categories.add')} onPress={startCreate} />
            </Card>
          ) : (
            <View style={styles.cardGap}>
              {(['expense', 'income'] as const).map((groupType) => {
                const group = items.filter((c) => c.type === groupType);
                if (group.length === 0) return null;
                return (
                  <View key={groupType} style={styles.cardGap}>
                    <Text style={styles.groupTitle}>
                      {groupType === 'expense' ? t('categories.group.expense') : t('categories.group.income')}
                    </Text>
                    <Card style={styles.card}>
                      {group.map((c) => (
                        <View key={c.id} style={[styles.row, c.parentId ? styles.rowChild : null]}>
                          <View style={styles.rowMain}>
                            <View
                              accessibility-hidden="true"
                              style={[styles.dot, { backgroundColor: swatchColorFor(c.color) }]}
                            />
                            <Text style={styles.rowName}>{c.name}</Text>
                          </View>
                          <View style={styles.rowActions}>
                            <Button
                              variant="ghost"
                              label={`${t('categories.edit')} ${c.name}`}
                              onPress={() => startEdit(c)}
                            />
                            <Button
                              variant="ghost"
                              label={`${t('categories.archive')} ${c.name}`}
                              onPress={() => {
                                setRemoveFailed(false);
                                void archive(c.id);
                              }}
                            />
                            <Button
                              variant="ghost"
                              label={`${t('common.delete')} ${c.name}`}
                              onPress={() => {
                                setRemoveFailed(false);
                                void remove(c.id).then((ok) => setRemoveFailed(!ok));
                              }}
                            />
                          </View>
                        </View>
                      ))}
                    </Card>
                  </View>
                );
              })}
            </View>
          )}
          {status !== 'empty' && <Button variant="secondary" label={t('categories.add')} onPress={startCreate} />}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: csColors.bgBase },
  content: { gap: csSpace.s4, padding: csSpace.s4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3 },
  title: { fontSize: 20, fontWeight: '700', color: csColors.textPrimary },
  card: { gap: csSpace.s3 },
  cardGap: { gap: csSpace.s3 },
  copy: { fontSize: 14, lineHeight: 22, color: csColors.textMuted },
  hint: { fontSize: 13, color: csColors.textMuted },
  groupTitle: { fontSize: 13, fontWeight: '600', color: csColors.textMuted },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: csColors.textPrimary },
  row: { gap: csSpace.s2, paddingVertical: csSpace.s2 },
  rowChild: { paddingLeft: csSpace.s4 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3, minHeight: 40 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowName: { fontSize: 15, color: csColors.textPrimary, flexShrink: 1 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: csSpace.s2 },
  chips: { flexDirection: 'row', gap: csSpace.s2 },
  chip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: csRadius.pill,
    backgroundColor: csColors.surfaceSunken,
  },
  chipSelected: { backgroundColor: csColors.primary },
  chipLabel: { fontSize: 15, fontWeight: '600', color: csColors.textPrimary },
  chipLabelSelected: { color: csColors.textOnPrimary },
  swatches: { flexDirection: 'row', gap: csSpace.s3 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  swatchSelected: { borderColor: csColors.textPrimary },
  errorBox: { gap: csSpace.s3 },
  errorText: { fontSize: 14, color: csColors.danger },
});
