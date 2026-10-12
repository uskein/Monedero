/**
 * Tests del store FLUX de categorías — 4 estados + create/update/archive/remove.
 * Repo inyectado (fake en memoria) para aislar el store de sql.js (HU-10).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCategoriesStore, categoriesErrorCode, type CategoriesRepo } from '../src/features/settings/store';
import type { Category, CategoryInput } from '../src/data/domain/categories';

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

/** Repo fake: en memoria, con unicidad NOCASE y fallo inyectable para error. */
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

describe('useCategoriesStore — estados (BP-08)', () => {
  it('init con repo vacío → status empty', async () => {
    await useCategoriesStore.getState().init(fakeRepo([]));
    expect(useCategoriesStore.getState().status).toBe('empty');
  });

  it('init con datos → status success', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a')]));
    expect(useCategoriesStore.getState().status).toBe('success');
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });

  it('init con repo que falla → status error + STORAGE_UNAVAILABLE', async () => {
    await useCategoriesStore.getState().init(fakeRepo([], { failList: true }));
    expect(useCategoriesStore.getState().status).toBe('error');
    expect(useCategoriesStore.getState().error).toBe('STORAGE_UNAVAILABLE');
  });

  it('init es idempotente (no re-inyecta el repo)', async () => {
    const repo = fakeRepo([makeCategory('a')]);
    await useCategoriesStore.getState().init(repo);
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('b')]));
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });
});

describe('useCategoriesStore — gestión (HU-10)', () => {
  it('create añade la categoría y refresca la lista', async () => {
    await useCategoriesStore.getState().init(fakeRepo([]));
    const ok = await useCategoriesStore.getState().create({ name: 'Viajes', type: 'expense' });
    expect(ok).toBe(true);
    expect(useCategoriesStore.getState().items.map((c) => c.name)).toEqual(['Viajes']);
    expect(useCategoriesStore.getState().status).toBe('success');
  });

  it('create duplicado NOCASE → formError INTEGRITY_VIOLATION', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a')]));
    const ok = await useCategoriesStore.getState().create({ name: 'COMIDA', type: 'expense' });
    expect(ok).toBe(false);
    expect(useCategoriesStore.getState().formError).toBe('INTEGRITY_VIOLATION');
  });

  it('create con nombre vacío → formError VALIDATION_FAILED (Zod)', async () => {
    await useCategoriesStore.getState().init(fakeRepo([]));
    // El store NO valida a mano: el repo real lanza ZodError → código traducido.
    const repo = fakeRepo([]);
    repo.create = async () => {
      const err = new Error('bad');
      err.name = 'ZodError';
      throw err;
    };
    await useCategoriesStore.setState({ repo, items: [], status: 'success' });
    const ok = await useCategoriesStore.getState().create({ name: '', type: 'expense' });
    expect(ok).toBe(false);
    expect(useCategoriesStore.getState().formError).toBe('VALIDATION_FAILED');
  });

  it('update renombra y limpia formError previo', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a')]));
    await useCategoriesStore.getState().create({ name: 'COMIDA', type: 'expense' });
    expect(useCategoriesStore.getState().formError).toBe('INTEGRITY_VIOLATION');
    const ok = await useCategoriesStore.getState().update('a', { name: 'Comida rica' });
    expect(ok).toBe(true);
    expect(useCategoriesStore.getState().formError).toBeNull();
    expect(useCategoriesStore.getState().items.find((c) => c.id === 'a')?.name).toBe('Comida rica');
  });

  it('archive retira la categoría de la lista activa', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a'), makeCategory('b')]));
    await useCategoriesStore.getState().archive('a');
    expect(useCategoriesStore.getState().items.map((c) => c.id)).toEqual(['b']);
  });

  it('remove con movimientos → false + formError INTEGRITY_VIOLATION (se archiva)', async () => {
    const repo = fakeRepo([makeCategory('a')], { failDeleteWithTx: ['a'] });
    await useCategoriesStore.getState().init(repo);
    const ok = await useCategoriesStore.getState().remove('a');
    expect(ok).toBe(false);
    expect(useCategoriesStore.getState().formError).toBe('INTEGRITY_VIOLATION');
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });

  it('remove sin referencias → true y desaparece', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a'), makeCategory('b')]));
    const ok = await useCategoriesStore.getState().remove('a');
    expect(ok).toBe(true);
    expect(useCategoriesStore.getState().items.map((c) => c.id)).toEqual(['b']);
  });

  it('clearFormError limpia el aviso sin tocar la lista', async () => {
    await useCategoriesStore.getState().init(fakeRepo([makeCategory('a')]));
    await useCategoriesStore.getState().create({ name: 'COMIDA', type: 'expense' });
    useCategoriesStore.getState().clearFormError();
    expect(useCategoriesStore.getState().formError).toBeNull();
    expect(useCategoriesStore.getState().items).toHaveLength(1);
  });
});

describe('categoriesErrorCode', () => {
  it('traduce INTEGRITY_VIOLATION, ZodError y el resto', () => {
    expect(categoriesErrorCode(new Error('INTEGRITY_VIOLATION'))).toBe('INTEGRITY_VIOLATION');
    const zod = new Error('bad');
    zod.name = 'ZodError';
    expect(categoriesErrorCode(zod)).toBe('VALIDATION_FAILED');
    expect(categoriesErrorCode(new Error('disk on fire'))).toBe('STORAGE_UNAVAILABLE');
  });
});
