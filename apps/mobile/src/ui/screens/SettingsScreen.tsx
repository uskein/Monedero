/**
 * SettingsScreen (móvil) — BP-08 (raíz de Ajustes) + sub Categorías (HU-10).
 * S6: hub con TEMO (HU-17: Claro/Oscuro/Sistema) y MONEDA global (HU-18:
 * COP/USD/EUR) persistidas en prefs + gestión de categorías (HU-10).
 * Estilos TEMÁTICOS: colores vía useThemeColors + useMemo (SSOT csColors/Dark).
 * Copy i18n — cero strings hardcodeados (gate i18n:check).
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SqlDbPort } from '../../infrastructure/db/SqlDbPort';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@monedero/i18n/react';
import { csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, Input } from '../design-system';
import { useThemeColors } from '../theme';
import { DataScreen } from './DataScreen';
import { usePrefsStore, type ThemePreference } from '../../state/prefs.store';
import { wipeAllData } from '../../infrastructure/db/wipe';
import { useCategoriesStore, type CategoriesRepo } from '../../state/categories.store';
import type { Category, CategoryType } from '../../core/domain/category';

export interface SettingsScreenProps {
  categories: CategoriesRepo;
  /** BD de la sesión (SqlDbPort) + bóveda para BP-09/BP-10 (S7). */
  db?: SqlDbPort;
  vaultId?: string | null;
}

const THEME_OPTIONS: Array<{ value: ThemePreference; key: 'settings.theme.light' | 'settings.theme.dark' | 'settings.theme.system'; icon: 'sunny' | 'moon' | 'phone-portrait' }> = [
  { value: 'light', key: 'settings.theme.light', icon: 'sunny' },
  { value: 'dark', key: 'settings.theme.dark', icon: 'moon' },
  { value: 'system', key: 'settings.theme.system', icon: 'phone-portrait' },
];

/**
 * Zona de peligro (HU-19 · F6): botón ghost ROJO (nunca primario) → escribir
 * la palabra clave → doble confirmación → wipe total → Onboarding.
 * Ofrece export antes (S7: se explica que llega en el próximo sprint).
 */
function DangerZoneCard({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  const t = useT();
  const [stage, setStage] = useState<'idle' | 'typed' | 'final'>('idle');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const required = t('danger.wipe.word');
  const wordOk = word.trim().toUpperCase() === required.toUpperCase();

  if (stage === 'idle') {
    return (
      <Card style={styles.card}>
        <Text style={styles.dangerTitle}>{t('danger.title')}</Text>
        <Text style={styles.copy}>{t('danger.copy')}</Text>
        <Button variant="ghost" label={t('danger.wipe')} onPress={() => setStage('typed')} />
      </Card>
    );
  }

  if (stage === 'typed') {
    return (
      <Card style={styles.card}>
        <Text style={styles.dangerTitle}>{t('danger.title')}</Text>
        <Text style={styles.copy}>{t('danger.copy')}</Text>
        <Text style={styles.copy}>{t('danger.export.soon')}</Text>
        <Input
          label={required}
          value={word}
          onValueChange={setWord}
          placeholder={required}
          disabled={busy}
        />
        <Text style={styles.hint}>{t('danger.wipe.hint', { word: required })}</Text>
        <View style={styles.rowActions}>
          <Button
            variant="ghost"
            label={t('danger.wipe')}
            disabled={!wordOk || busy}
            onPress={() => setStage('final')}
          />
          <Button
            variant="ghost"
            label={t('common.cancel')}
            disabled={busy}
            onPress={() => {
              setWord('');
              setStage('idle');
            }}
          />
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text accessibilityRole="alert" style={styles.dangerTitle}>
        {t('danger.wipe.title')}
      </Text>
      <Text style={styles.copy}>{t('danger.copy')}</Text>
      <View style={styles.rowActions}>
        <Button
          variant="ghost"
          label={t('danger.wipe.confirm')}
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void wipeAllData().finally(() => {
              // Tras el wipe la bóveda re-arranca en Onboarding; este árbol
              // se desmonta. El estado local deja de importar.
              setBusy(false);
            });
          }}
        />
        <Button
          variant="ghost"
          label={t('common.cancel')}
          disabled={busy}
          onPress={() => {
            setWord('');
            setStage('idle');
          }}
        />
      </View>
    </Card>
  );
}

const CURRENCY_OPTIONS = ['COP', 'USD', 'EUR'] as const;

/** Paleta restringida a tokens --cs-* (criterio HU-10). */
const SWATCH_TOKENS = ['primary', 'secondary', 'accent', 'danger'] as const;
type SwatchToken = (typeof SWATCH_TOKENS)[number];

export function SettingsScreen({ categories, db, vaultId }: SettingsScreenProps) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [view, setView] = useState<'hub' | 'categories' | 'data'>('hub');

  if (view === 'categories') {
    return <CategoriesManager repo={categories} onBack={() => setView('hub')} />;
  }
  if (view === 'data') {
    return <DataScreen db={db} vaultId={vaultId} onBack={() => setView('hub')} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('settings.title')}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      {/* HU-17 · tema */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.theme')}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.theme')} style={styles.chips}>
          {THEME_OPTIONS.map((opt) => (
            <ThemeChip key={opt.value} option={opt} />
          ))}
        </View>
      </Card>

      {/* HU-18 · moneda global */}
      <CurrencyCard styles={styles} />

      {/* HU-19 · F6 · zona de peligro */}
      <DangerZoneCard styles={styles} />

      {/* HU-10 · categorías */}
      <Card style={styles.card}>
        <Text style={styles.copy}>{t('settings.categories.copy')}</Text>
        <Button variant="secondary" label={t('settings.categories')} onPress={() => setView('categories')} />
      </Card>

      {/* S7 · datos (BP-09 export / BP-10 import) */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t('data.title')}</Text>
        <Button variant="secondary" label={t('data.export')} onPress={() => setView('data')} />
      </Card>
    </ScrollView>
  );
}

function ThemeChip({
  option,
}: {
  option: { value: ThemePreference; key: 'settings.theme.light' | 'settings.theme.dark' | 'settings.theme.system'; icon: 'sunny' | 'moon' | 'phone-portrait' };
}) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const theme = usePrefsStore((s) => s.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);
  const selected = theme === option.value;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t(option.key)}
      onPress={() => void setTheme(option.value)}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Ionicons name={option.icon} size={15} color={selected ? c.textOnPrimary : c.textMuted} />
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{t(option.key)}</Text>
    </Pressable>
  );
}

function CurrencyCard({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  const t = useT();
  const currency = usePrefsStore((s) => s.currency);
  const setCurrency = usePrefsStore((s) => s.setCurrency);
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('common.currency')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('common.currency')} style={styles.chips}>
        {CURRENCY_OPTIONS.map((code) => {
          const selected = currency === code;
          return (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={code}
              onPress={() => void setCurrency(code)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{code}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** Devuelve los colores del swatch desde los tokens activos (tema-aware). */
function swatchColorFor(color: string, c: ReturnType<typeof useThemeColors>): string {
  const palette: Record<SwatchToken, string> = {
    primary: c.primary,
    secondary: c.secondary,
    accent: c.accent,
    danger: c.danger,
  };
  return Object.values(palette).includes(color) ? color : c.surfaceSunken;
}

export function CategoriesManager({ repo, onBack }: { repo: CategoriesRepo; onBack: () => void }) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
    const palette: Record<SwatchToken, string> = {
      primary: c.primary,
      secondary: c.secondary,
      accent: c.accent,
      danger: c.danger,
    };
    const match = (Object.keys(palette) as SwatchToken[]).find((k) => palette[k] === category.color);
    setSwatch(match ?? 'primary');
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
    const palette: Record<SwatchToken, string> = {
      primary: c.primary,
      secondary: c.secondary,
      accent: c.accent,
      danger: c.danger,
    };
    const color = palette[swatch];
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
        <View style={styles.gap}>
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
          <SwatchPicker
            value={swatch}
            onPick={(v) => {
              setSwatch(v);
              setColorDirty(true);
            }}
          />
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
        <View style={styles.gap}>
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
            <View style={styles.gap}>
              {(['expense', 'income'] as const).map((groupType) => {
                const group = items.filter((cat) => cat.type === groupType);
                if (group.length === 0) return null;
                return (
                  <View key={groupType} style={styles.gap}>
                    <Text style={styles.groupTitle}>
                      {groupType === 'expense' ? t('categories.group.expense') : t('categories.group.income')}
                    </Text>
                    <Card style={styles.card}>
                      {group.map((cat) => (
                        <View key={cat.id} style={[styles.row, cat.parentId ? styles.rowChild : null]}>
                          <View style={styles.rowMain}>
                            <View
                              accessibility-hidden="true"
                              style={[styles.dot, { backgroundColor: swatchColorFor(cat.color, c) }]}
                            />
                            <Text style={styles.rowName}>{cat.name}</Text>
                          </View>
                          {/* Acciones por ICONO (el texto desbordaba); el
                              nombre accesible sigue siendo «Editar/Archivar/
                              Eliminar + nombre» (a11y A.3 y tests intactos). */}
                          <View style={styles.rowActions}>
                            <IconButton
                              icon="create-outline"
                              label={`${t('categories.edit')} ${cat.name}`}
                              onPress={() => startEdit(cat)}
                            />
                            <IconButton
                              icon="archive-outline"
                              label={`${t('categories.archive')} ${cat.name}`}
                              onPress={() => {
                                setRemoveFailed(false);
                                void archive(cat.id);
                              }}
                            />
                            <IconButton
                              icon="trash-outline"
                              label={`${t('common.delete')} ${cat.name}`}
                              danger
                              onPress={() => {
                                setRemoveFailed(false);
                                void remove(cat.id).then((ok) => setRemoveFailed(!ok));
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

/** Type chips (Gasto/Ingreso) con rol radio - espejo del Segmented de la PWA. */
function TypeChips({ value, onChange }: { value: CategoryType; onChange: (v: CategoryType) => void }) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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

/** Selector de color (radiogroup) - SOLO swatches de tokens --cs-*. */
function SwatchPicker({ value, onPick }: { value: SwatchToken; onPick: (v: SwatchToken) => void }) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const palette: Record<SwatchToken, string> = {
    primary: c.primary,
    secondary: c.secondary,
    accent: c.accent,
    danger: c.danger,
  };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('categories.form.color')} style={styles.swatches}>
      {SWATCH_TOKENS.map((token) => (
        <Pressable
          key={token}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === token }}
          accessibilityLabel={token}
          onPress={() => onPick(token)}
          style={[styles.swatch, { backgroundColor: palette[token] }, value === token && styles.swatchSelected]}
        />
      ))}
    </View>
  );
}

/** Botón de acción por icono (44 dp de área táctil) con nombre accesible. */
function IconButton({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={styles.iconBtn}
    >
      <Ionicons name={icon} size={20} color={danger ? c.danger : c.textPrimary} />
    </Pressable>
  );
}

/** Estilos temáticos: se recrean al cambiar el tema (SSOT csColors/Dark). */
function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bgBase },
    content: { gap: csSpace.s4, padding: csSpace.s4 },
    header: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3 },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    cardTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    card: { gap: csSpace.s3 },
    copy: { fontSize: 14, lineHeight: 22, color: c.textMuted },
    gap: { gap: csSpace.s3 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    groupTitle: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    row: { gap: csSpace.s2, paddingVertical: csSpace.s2 },
    rowChild: { paddingLeft: csSpace.s4 },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3, minHeight: 40, flexShrink: 1 },
    dot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
    rowName: { fontSize: 15, color: c.textPrimary, flexShrink: 1 },
    rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: csSpace.s2, marginTop: csSpace.s1 },
    iconBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: csRadius.pill,
      backgroundColor: c.surfaceSunken,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: csSpace.s2 },
    hint: { fontSize: 12, color: c.textMuted },
    dangerTitle: { fontSize: 15, fontWeight: '700', color: c.danger },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: csSpace.s2,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: csSpace.s4,
      borderRadius: csRadius.pill,
      backgroundColor: c.surfaceSunken,
      flexShrink: 1,
      maxWidth: '100%',
    },
    chipSelected: { backgroundColor: c.primary },
    chipLabel: { fontSize: 15, fontWeight: '600', color: c.textPrimary, flexShrink: 1 },
    chipLabelSelected: { color: c.textOnPrimary },
    swatches: { flexDirection: 'row', gap: csSpace.s3 },
    swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
    swatchSelected: { borderColor: c.textPrimary },
    errorText: { fontSize: 14, color: c.danger },
  });
}
