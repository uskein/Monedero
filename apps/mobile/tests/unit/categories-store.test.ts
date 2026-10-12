/**
 * Tests del store de categorías móvil — espejo de la PWA (4 estados +
 * gestión HU-10). Repo inyectado (fake en memoria) para aislar el store.
 */
import { useCategoriesStore, categoriesErrorCode, type CategoriesRepo } from '../../src/state/categories.store';
import type { Category, CategoryInput } from '../../src/core/domain/category';

function makeCategory(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    name: 'Comida',
    type: 'expense',
    parentId: null,
    icon: 'tag',
    color: '#2F7D5B',
    sortOrder: 0,
    createdAt: '2026-10-11T12:00:00.000Z',
    updatedAt: '2026-10-11T12:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function fakeRepo(
  seed: Category[] = [],
  opts: { failList?: boolean; failDeleteWithTx?: string[] } = {},
): CategoriesRepo & { data: Category[] } {
  const data = [...seed];
  return {
    data,
    async list() {
      if (opts.failList) throw new Error('boom');
      return data.filter((c) => !c.deletedAt);
    },
    async create(input: CategoryInput) {
      const dup = data.find(
        (c) => !c.deletedAt && c.name.toLowerCase() === input.name.trim().toLowerCase(),
      );
      if (dup) throw new Error('INTEGRITY_VIOLATION');
      const cat = makeCategory(`cat-${data.length + 1}`, {
        name: input.name.trim(),
        type: input.type,
        color: input.color ?? '#2F7D5B',
      });
      data.push(cat);
      return cat;
    },
    async update(id: string, patch: { name?: string }) {
      const cat = data.find((c) => c.id === id);
      if (!cat) throw new Error('CATEGORY_NOT_FOUND');
      if (patch.name) cat.name = patch.name;
      return cat;
    },
    async archive(id: string) {
      const cat = data.find((c) => c.id === id);
      if (cat) cat.deletedAt = '2026-10-11T13:00:00.000Z';
    },
    async remove(id: string) {
      if (opts.failDeleteWithTx?.includes(id)) throw new Error('INTEGRITY_VIOLATION');
      const idx = data.findIndex((c) => c.id === id);
      if (idx >= 0) data.splice(idx, 1);
    },
    subscribe() {
      return () => undefined;
    },
  };
}

beforeEach(() => {
  useCategoriesStore.setState({
    status: 'loading',
    items: [],
    error: null,
    formError: null,
    repo: null,
  });
});

describe('useCategoriesStore móvil — estados (BP-08)', () => {
  it('init con repo vacío → empty; con datos → success', async () => {
    await useCategoriesStore.getState().init(fakeRepo([]));
    expect(useCategoriesStore.getState().status).toBe('empty');
    useCategoriesStore.setState({ repo: null });
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a')]));
    expect(useCategoriesStore.getState().status).toBe('success');
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });

  it('init con repo que falla → error + STORAGE_UNAVAILABLE', async () => {
    await useCategoriesStore.getState().init(fakeRepo([], { failList: true }));
    expect(useCategoriesStore.getState().status).toBe('error');
    expect(useCategoriesStore.getState().error).toBe('STORAGE_UNAVAILABLE');
  });

  it('init es idempotente', async () => {
    const repo = fakeRepo([makeCategory('a')]);
    await useCategoriesStore.getState().init(repo);
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('b')]));
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });
});

describe('useCategoriesStore móvil — gestión (HU-10)', () => {
  it('create añade; duplicado NOCASE → INTEGRITY_VIOLATION', async () => {
    await useCategoriesStore.getState().init(fakeRepo([]));
    expect(await useCategoriesStore.getState().create({ name: 'Viajes', type: 'expense' })).toBe(true);
    expect(await useCategoriesStore.getState().create({ name: 'viajes', type: 'expense' })).toBe(false);
    expect(useCategoriesStore.getState().formError).toBe('INTEGRITY_VIOLATION');
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });

  it('update renombra y limpia formError; archive retira de la lista', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a'), makeCategory('b', { name: 'Salario', type: 'income' })]));
    await useCategoriesStore.getState().create({ name: 'COMIDA', type: 'expense' }); // duplicado
    expect(useCategoriesStore.getState().formError).toBe('INTEGRITY_VIOLATION');
    const ok = await useCategoriesStore.getState().update('a', { name: 'Comida rica' });
    expect(ok).toBe(true);
    expect(useCategoriesStore.getState().formError).toBeNull();
    await useCategoriesStore.getState().archive('b');
    expect(useCategoriesStore.getState().items.map((c) => c.id)).toEqual(['a']);
  });

  it('remove con movimientos → false + INTEGRITY_VIOLATION (se archiva)', async () => {
    const repo = fakeRepo([makeCategory('a')], { failDeleteWithTx: ['a'] });
    await useCategoriesStore.getState().init(repo);
    expect(await useCategoriesStore.getState().remove('a')).toBe(false);
    expect(useCategoriesStore.getState().formError).toBe('INTEGRITY_VIOLATION');
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });

  it('clearFormError limpia el aviso sin tocar la lista', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a')]));
    await useCategoriesStore.getState().create({ name: 'COMIDA', type: 'expense' });
    useCategoriesStore.getState().clearFormError();
    expect(useCategoriesStore.getState().formError).toBeNull();
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });
});

describe('categoriesErrorCode móvil', () => {
  it('traduce INTEGRITY_VIOLATION, ZodError y el resto', () => {
    expect(categoriesErrorCode(new Error('INTEGRITY_VIOLATION'))).toBe('INTEGRITY_VIOLATION');
    const zod = new Error('bad');
    zod.name = 'ZodError';
    expect(categoriesErrorCode(zod)).toBe('VALIDATION_FAILED');
    expect(categoriesErrorCode(new Error('disk on fire'))).toBe('STORAGE_UNAVAILABLE');
  });
});
