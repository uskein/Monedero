/**
 * CategoriesManager — subpantalla de Ajustes (BP-08) · HU-10.
 * 4 estados obligatorios (loading/empty/success/error) + alta con tipo y color
 * restringido a tokens --cs-* (criterio HU-10: nunca hex sueltos en UI).
 * Editar renombra; Archivar es un tombstone siempre permitido; Eliminar es
 * físico y con movimientos devuelve INTEGRITY_VIOLATION («se archiva»).
 */
import { useEffect, useState } from 'react';
import { csColors } from '@monedero/tokens';
import { useT } from '@monedero/i18n/react';
import { Button, Card, EmptyState, Field, Input, Segmented, Spinner } from '../../design-system';
import { getCategoriesRepo } from '../../data/db/session';
import { useCategoriesStore, type CategoriesRepo } from './store';
import type { Category, CategoryType } from '../../data/domain/categories';

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

export interface CategoriesManagerProps {
  onBack: () => void;
  /** Solo tests: repo en memoria para no tocar sql.js en la UI. */
  repoOverride?: CategoriesRepo;
}

export function CategoriesManager({ onBack, repoOverride }: CategoriesManagerProps) {
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
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const repo = repoOverride ?? (await getCategoriesRepo());
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
    <section aria-label={t('categories.title')} style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cs-space-3)' }}>
        <Button variant="ghost" onClick={onBack} aria-label={t('categories.back')}>
          ←
        </Button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('categories.title')}</h2>
      </div>

      {bootError || status === 'error' ? (
        <div style={{ display: 'grid', gap: 'var(--cs-space-3)' }}>
          <p role="alert" style={{ color: csColors.danger, margin: 0 }}>
            {t('categories.error')}
          </p>
          <Button variant="secondary" onClick={() => void reload()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : status === 'loading' ? (
        <Spinner label={t('common.loading')} />
      ) : showForm ? (
        <Card style={{ display: 'grid', gap: 'var(--cs-space-4)', textAlign: 'left' }}>
          <Field label={t('categories.form.name')} error={nameError ?? undefined}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                inputId={inputId}
                describedBy={describedBy}
                invalid={invalid}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('categories.form.name.placeholder')}
              />
            )}
          </Field>

          {mode === 'create' && (
            <Segmented
              label={t('categories.form.type')}
              options={[
                { value: 'expense', label: t('tx.type.expense') },
                { value: 'income', label: t('tx.type.income') },
              ]}
              value={type}
              onChange={setType}
            />
          )}

          <div role="radiogroup" aria-label={t('categories.form.color')} style={{ display: 'flex', gap: 'var(--cs-space-3)' }}>
            {CATEGORY_SWATCHES.map((s) => (
              <button
                key={s.token}
                type="button"
                role="radio"
                aria-checked={swatch === s.token}
                aria-label={s.token}
                onClick={() => {
                  setSwatch(s.token);
                  setColorDirty(true);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: s.color,
                  border: swatch === s.token ? `3px solid ${csColors.textPrimary}` : '3px solid transparent',
                }}
              />
            ))}
          </div>

          {formErrorMessage && (
            <p role="alert" style={{ color: csColors.danger, margin: 0 }}>
              {formErrorMessage}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--cs-space-3)' }}>
            <Button variant="primary" onClick={() => void handleSubmit()}>
              {t('categories.save')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMode('list');
                setEditing(null);
                clearFormError();
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {removeFailed && (
            <p role="alert" style={{ color: csColors.danger, margin: 0 }}>
              {t('categories.error.delete')}
            </p>
          )}
          {status === 'empty' ? (
            <EmptyState
              title={t('categories.empty.title')}
              copy={t('categories.empty.copy')}
              action={
                <Button variant="primary" onClick={startCreate}>
                  {t('categories.add')}
                </Button>
              }
            />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--cs-space-2)' }}>
              {(['expense', 'income'] as const).flatMap((groupType) => {
                const group = items.filter((c) => c.type === groupType);
                if (group.length === 0) return [];
                return [
                  <li
                    key={`heading-${groupType}`}
                    style={{ fontSize: 13, fontWeight: 600, color: csColors.textMuted, marginTop: 'var(--cs-space-2)' }}
                  >
                    {groupType === 'expense' ? t('categories.group.expense') : t('categories.group.income')}
                  </li>,
                  ...group.map((c) => (
                    <li
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--cs-space-3)',
                        paddingLeft: c.parentId ? 'var(--cs-space-4)' : 0,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{ width: 12, height: 12, borderRadius: 12, background: swatchColorFor(c.color), flexShrink: 0 }}
                      />
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <Button variant="ghost" onClick={() => startEdit(c)} aria-label={`${t('categories.edit')} ${c.name}`}>
                        {t('categories.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void archive(c.id)}
                        aria-label={`${t('categories.archive')} ${c.name}`}
                      >
                        {t('categories.archive')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setRemoveFailed(false);
                          void remove(c.id).then((ok) => setRemoveFailed(!ok));
                        }}
                        aria-label={`${t('common.delete')} ${c.name}`}
                      >
                        {t('common.delete')}
                      </Button>
                    </li>
                  )),
                ];
              })}
            </ul>
          )}
          {status !== 'empty' && (
            <Button variant="secondary" onClick={startCreate}>
              {t('categories.add')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
