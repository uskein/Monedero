/**
 * Tests del budgets store (BP-06 · HU-11·12 · tarea 5.3) — 4 estados,
 * evaluación de uso, alertas `budget:exceeded` (cruce 80/100 sin repetir)
 * y save() F4 (slot ocupado → duplicate «editar existente»).
 * Repo inyectado (fake en memoria) para aislar el store de sql.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useBudgetsStore,
  type BudgetRow,
  type BudgetsDeps,
  type BudgetsRepo,
} from '../src/features/budgets/store';
import type { Budget, BudgetInput } from '../src/data/domain/budgets';

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

/**
 * Repo fake: presupuestos en memoria + gasto por categoría mutable (para
 * disparar reevaluaciones vía onTxEvent como si llegara un movimiento).
 */
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

function makeDeps(fake: ReturnType<typeof fakeBudgets>, opts: { txListener?: boolean } = {}): {
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
    onTxEvent: opts.txListener === false ? undefined : (cb) => {
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

describe('useBudgetsStore — estados (BP-06)', () => {
  it('init sin topes → empty', async () => {
    const fake = fakeBudgets([]);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    expect(useBudgetsStore.getState().status).toBe('empty');
    expect(useBudgetsStore.getState().items).toEqual([]);
  });

  it('init con topes → success con filas (nombre, uso y nivel)', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 50_000);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const state = useBudgetsStore.getState();
    expect(state.status).toBe('success');
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      budgetId: 'b1',
      categoryId: 'cat-comida',
      categoryName: 'Comida',
      budgetCents: 100_000,
      spentCents: 50_000,
      level: 'ok',
    });
    expect(state.items[0]?.ratio).toBeCloseTo(0.5);
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

describe('useBudgetsStore — alertas budget:exceeded (HU-12 · F4)', () => {
  it('primer aviso al cruzar 80 % por un movimiento → toast warn', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    const { deps, fireTx } = makeDeps(fake);
    await useBudgetsStore.getState().init(deps);
    expect(useBudgetsStore.getState().toast).toBeNull();

    fake.setSpend('cat-comida', 85_000); // 85 %
    fireTx();
    await new Promise<void>((r) => setTimeout(r, 0));

    const state = useBudgetsStore.getState();
    expect(state.toast).toMatchObject({
      categoryId: 'cat-comida',
      categoryName: 'Comida',
      period: '2026-10',
      level: 'warn',
    });
    expect(state.toast?.ratio).toBeCloseTo(0.85);
    expect(state.items[0]?.level).toBe('warn');
  });

  it('cruzar 100 % → toast exceeded (nivel superior al previo)', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    const { deps, fireTx } = makeDeps(fake);
    fake.setSpend('cat-comida', 85_000);
    await useBudgetsStore.getState().init(deps); // ya en warn
    expect(useBudgetsStore.getState().toast?.level).toBe('warn');

    useBudgetsStore.getState().clearToast();
    fake.setSpend('cat-comida', 120_000); // 120 %
    fireTx();
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(useBudgetsStore.getState().toast).toMatchObject({ level: 'exceeded', ratio: 1.2 });
    expect(useBudgetsStore.getState().items[0]?.level).toBe('exceeded');
  });

  it('sin cambio de nivel → NO repite el aviso (sereno, no insiste)', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    const { deps, fireTx } = makeDeps(fake);
    fake.setSpend('cat-comida', 90_000);
    await useBudgetsStore.getState().init(deps);
    expect(useBudgetsStore.getState().toast?.level).toBe('warn');

    useBudgetsStore.getState().clearToast();
    fake.setSpend('cat-comida', 95_000); // sigue en warn
    fireTx();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(useBudgetsStore.getState().toast).toBeNull();
  });

  it('la primera carga ya sobre el umbral también informa (una vez)', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 150_000);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    expect(useBudgetsStore.getState().toast).toMatchObject({ level: 'exceeded' });

    useBudgetsStore.getState().clearToast();
    await useBudgetsStore.getState().reload();
    expect(useBudgetsStore.getState().toast).toBeNull(); // no reavisa
  });

  it('clearToast limpia el aviso sin tocar las filas', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 90_000);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    useBudgetsStore.getState().clearToast();
    expect(useBudgetsStore.getState().toast).toBeNull();
    expect(useBudgetsStore.getState().items).toHaveLength(1);
  });
});

describe('useBudgetsStore — save (HU-11 · F4)', () => {
  it('alta en slot libre → upsert + recarga → true', async () => {
    const fake = fakeBudgets([]);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    const ok = await useBudgetsStore.getState().save({ categoryId: 'cat-comida', amountCents: 200_000 });
    expect(ok).toBe(true);
    const row = useBudgetsStore.getState().items.find((i) => i.categoryId === 'cat-comida');
    expect(row?.budgetCents).toBe(200_000);
    expect(useBudgetsStore.getState().duplicate).toBeNull();
    expect(useBudgetsStore.getState().formError).toBeNull();
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
    expect(useBudgetsStore.getState().items[0]?.budgetCents).toBe(100_000); // no pisó
  });

  it('edición del existente (editingCategoryId) → upsert sin duplicate → true', async () => {
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

  it('clearDuplicate + clearFormError devuelven el estado limpio', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    await useBudgetsStore.getState().init(makeDeps(fake).deps);
    await useBudgetsStore.getState().save({ categoryId: 'cat-comida', amountCents: 50_000 });
    useBudgetsStore.getState().clearDuplicate();
    expect(useBudgetsStore.getState().duplicate).toBeNull();
    expect(useBudgetsStore.getState().formError).toBeNull();
  });
});

describe('useBudgetsStore — filas derivadas', () => {
  it('el nivel de cada fila refleja evaluateBudgets (warn en 80 %)', async () => {
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
