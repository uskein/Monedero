/**
 * Tests del budgets store móvil (BP-06 · HU-11·12 · tarea 5.3) — espejo de
 * la PWA: 4 estados, uso + niveles, alertas budget:exceeded (cruce 80/100 sin
 * repetir) y save F4 (slot ocupado → duplicate «editar existente»).
 * Jest (globals): NO importar de vitest.
 */
import {
  useBudgetsStore,
  type BudgetRow,
  type BudgetsDeps,
  type BudgetsRepo,
} from '../../src/state/budgets.store';
import type { Budget, BudgetInput } from '../../src/core/domain/budget';

function makeBudget(id: string, categoryId: string, amountCents: number, period = '2026-10'): Budget {
  return {
    id,
    categoryId,
    period,
    amountCents,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    deletedAt: null,
  };
}

function fakeBudgets(
  seed: Budget[] = [],
  opts: { failList?: boolean; failUpsertZod?: boolean } = {},
) {
  const data = [...seed];
  const spentByCategory: Record<string, number> = {};
  const repo: BudgetsRepo = {
    async get(categoryId, period) {
      return data.find((b) => b.categoryId === categoryId && b.period === period) ?? null;
    },
    async listByPeriod(period) {
      if (opts.failList) throw new Error('boom');
      return data.filter((b) => b.period === period);
    },
    async upsert(input: BudgetInput) {
      if (opts.failUpsertZod) {
        const err = new Error('bad');
        err.name = 'ZodError';
        throw err;
      }
      const existing = data.find(
        (b) => b.categoryId === input.categoryId && b.period === input.period,
      );
      if (existing) {
        existing.amountCents = input.amountCents;
        return existing;
      }
      const created = makeBudget(`b-${data.length + 1}`, input.categoryId, input.amountCents, input.period);
      data.push(created);
      return created;
    },
    async usage(categoryId, period) {
      const budget = data.find((b) => b.categoryId === categoryId && b.period === period);
      const spentCents = spentByCategory[categoryId] ?? 0;
      const budgetCents = budget?.amountCents ?? 0;
      return {
        spentCents,
        budgetCents,
        ratio: budgetCents > 0 ? spentCents / budgetCents : 0,
      };
    },
  };
  return {
    repo,
    data,
    setSpend(categoryId: string, cents: number) {
      spentByCategory[categoryId] = cents;
    },
  };
}

function makeDeps(fake: ReturnType<typeof fakeBudgets>): {
  deps: BudgetsDeps;
  fireTx: () => void;
} {
  let listener: (() => void) | null = null;
  const deps: BudgetsDeps = {
    budgets: fake.repo,
    period: '2026-10',
    loadCategories: async () => [
      { id: 'cat-comida', name: 'Comida' },
      { id: 'cat-ocio', name: 'Ocio' },
    ],
    onTxEvent: (cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
  };
  return { deps, fireTx: () => listener?.() };
}

beforeEach(() => {
  useBudgetsStore.setState({
    status: 'loading',
    period: '2026-10',
    items: [],
    error: null,
    duplicate: null,
    formError: null,
    toast: null,
    deps: null,
    levels: {},
  });
});

describe('useBudgetsStore móvil — estados (BP-06)', () => {
  it('init sin topes → empty; con topes → success con filas', async () => {
    await useBudgetsStore.getState().init(makeDeps(fakeBudgets([])).deps);
    expect(useBudgetsStore.getState().status).toBe('empty');

    useBudgetsStore.setState({ deps: null });
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 50_000);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const state = useBudgetsStore.getState();
    expect(state.status).toBe('success');
    expect(state.items[0]).toMatchObject({
      budgetId: 'b1',
      categoryName: 'Comida',
      budgetCents: 100_000,
      spentCents: 50_000,
      level: 'ok',
    });
    expect(state.toast).toBeNull(); // 50 % no alerta
  });

  it('init con listByPeriod que falla → error + STORAGE_UNAVAILABLE', async () => {
    const fake = fakeBudgets([], { failList: true });
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    expect(useBudgetsStore.getState().status).toBe('error');
    expect(useBudgetsStore.getState().error).toBe('STORAGE_UNAVAILABLE');
  });

  it('init es idempotente (no reinyecta deps)', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    const { deps } = makeDeps(fake);
    await useBudgetsStore.getState().init(deps);
    await useBudgetsStore.getState().init({ budgets: fakeBudgets([]).repo, period: '2026-10' });
    expect(useBudgetsStore.getState().items).toHaveLength(1);
  });
});

describe('useBudgetsStore móvil — alertas budget:exceeded (HU-12 · F4)', () => {
  it('cruce de 80 % por movimiento → toast warn; nivel sin cambio → no repite', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    const { deps, fireTx } = makeDeps(fake);
    await useBudgetsStore.getState().init(deps);
    expect(useBudgetsStore.getState().toast).toBeNull();

    fake.setSpend('cat-comida', 85_000);
    fireTx();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(useBudgetsStore.getState().toast).toMatchObject({
      categoryId: 'cat-comida',
      categoryName: 'Comida',
      level: 'warn',
    });

    useBudgetsStore.getState().clearToast();
    fake.setSpend('cat-comida', 95_000); // sigue en warn
    fireTx();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(useBudgetsStore.getState().toast).toBeNull();
  });

  it('cruzar 100 % → toast exceeded', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    const { deps, fireTx } = makeDeps(fake);
    await useBudgetsStore.getState().init(deps);

    fake.setSpend('cat-comida', 120_000);
    fireTx();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(useBudgetsStore.getState().toast).toMatchObject({ level: 'exceeded' });
    expect(useBudgetsStore.getState().items[0]?.level).toBe('exceeded');
  });

  it('la primera carga ya sobre el umbral informa UNA vez', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 150_000);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    expect(useBudgetsStore.getState().toast).toMatchObject({ level: 'exceeded' });

    useBudgetsStore.getState().clearToast();
    await useBudgetsStore.getState().reload();
    expect(useBudgetsStore.getState().toast).toBeNull();
  });
});

describe('useBudgetsStore móvil — save (HU-11 · F4)', () => {
  it('alta en slot libre → upsert + recarga → true', async () => {
    const fake = fakeBudgets([]);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const ok = await useBudgetsStore.getState().save({ categoryId: 'cat-comida', amountCents: 200_000 });
    expect(ok).toBe(true);
    expect(
      useBudgetsStore.getState().items.find((i) => i.categoryId === 'cat-comida')?.budgetCents,
    ).toBe(200_000);
  });

  it('alta sobre slot ocupado → false + duplicate con budgetId («editar existente»)', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const ok = await useBudgetsStore.getState().save({ categoryId: 'cat-comida', amountCents: 50_000 });
    expect(ok).toBe(false);
    expect(useBudgetsStore.getState().duplicate).toEqual({
      budgetId: 'b1',
      categoryId: 'cat-comida',
      categoryName: 'Comida',
    });
    expect(useBudgetsStore.getState().formError).toBe('INTEGRITY_VIOLATION');
    expect(useBudgetsStore.getState().items[0]?.budgetCents).toBe(100_000);
  });

  it('edición (editingCategoryId) → upsert sin duplicate → true', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const ok = await useBudgetsStore.getState().save(
      { categoryId: 'cat-comida', amountCents: 150_000 },
      { editingCategoryId: 'cat-comida' },
    );
    expect(ok).toBe(true);
    expect(useBudgetsStore.getState().items[0]?.budgetCents).toBe(150_000);
    expect(useBudgetsStore.getState().duplicate).toBeNull();
  });

  it('amountCents ≤ 0 → Zod del repo → false + VALIDATION_FAILED', async () => {
    const fake = fakeBudgets([], { failUpsertZod: true });
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const ok = await useBudgetsStore.getState().save({ categoryId: 'cat-comida', amountCents: 0 });
    expect(ok).toBe(false);
    expect(useBudgetsStore.getState().formError).toBe('VALIDATION_FAILED');
  });

  it('niveles por fila reflejan evaluateBudgets (warn en 80 %)', async () => {
    const fake = fakeBudgets([
      makeBudget('b1', 'cat-comida', 100_000),
      makeBudget('b2', 'cat-ocio', 50_000),
    ]);
    fake.setSpend('cat-comida', 80_000);
    fake.setSpend('cat-ocio', 10_000);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const levels: Record<string, BudgetRow['level']> = Object.fromEntries(
      useBudgetsStore.getState().items.map((i) => [i.categoryId, i.level]),
    );
    expect(levels).toEqual({ 'cat-comida': 'warn', 'cat-ocio': 'ok' });
  });
});
