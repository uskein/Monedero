/**
 * Budgets store (móvil) — espejo de la PWA (features/budgets/store.ts).
 * BP-06 · HU-11·12 (tarea 5.3): carga los topes del mes, evalúa uso con
 * evaluateBudgets (80 % warn · 100 % exceeded) y emite `budget:exceeded`
 * para el toast sereno de 4000 ms. F4: save() previene el slot ocupado
 * («editar existente») antes del upsert idempotente del repo.
 */
import { create } from 'zustand';
import {
  currentPeriod,
  evaluateBudgets,
  type Budget,
  type BudgetInput,
  type BudgetLevel,
} from '../core/domain/budget';

/** Puerto mínimo que consume el store (misma semántica que el repo real). */
export interface BudgetsRepo {
  get(categoryId: string, period: string): Promise<Budget | null>;
  listByPeriod(period: string): Promise<Budget[]>;
  upsert(input: BudgetInput): Promise<Budget>;
  /** Borra el tope del mes (tombstone). Idempotente. */
  remove(categoryId: string, period: string): Promise<void>;
  usage(
    categoryId: string,
    period: string,
  ): Promise<{ spentCents: number; budgetCents: number; ratio: number }>;
}

export interface BudgetRow {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetCents: number;
  spentCents: number;
  ratio: number;
  level: BudgetLevel;
}

/** Payload del evento budget:exceeded (contrato + copy serena para la UI). */
export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  period: string;
  ratio: number;
  level: BudgetLevel;
}

export interface BudgetsDeps {
  budgets: BudgetsRepo;
  /** Cambios de movimientos → reevaluar usage (F4). Devuelve el unsubscribe. */
  onTxEvent?: (cb: () => void) => () => void;
  /** Nombres de categoría (una sola carga). */
  loadCategories?: () => Promise<Array<{ id: string; name: string }>>;
  /** Periodo por defecto: mes local actual. */
  period?: string;
}

export type BudgetsStatus = 'loading' | 'empty' | 'success' | 'error';

const LEVEL_RANK: Record<BudgetLevel, number> = { ok: 0, warn: 1, exceeded: 2 };

interface BudgetsState {
  status: BudgetsStatus;
  period: string;
  items: BudgetRow[];
  error: string | null;
  duplicate: { budgetId: string; categoryId: string; categoryName: string } | null;
  formError: string | null;
  toast: BudgetAlert | null;
  deps: BudgetsDeps | null;
  levels: Record<string, BudgetLevel>;

  init: (deps: BudgetsDeps) => Promise<void>;
  reload: () => Promise<void>;
  save: (
    input: { categoryId: string; amountCents: number },
    opts?: { editingCategoryId?: string },
  ) => Promise<boolean>;
  /** Elimina el tope de la categoría del periodo (tombstone) y recarga. */
  remove: (categoryId: string) => Promise<boolean>;
  clearToast: () => void;
  clearDuplicate: () => void;
  clearFormError: () => void;
}

async function loadFromRepo(
  deps: BudgetsDeps,
  prevLevels: Record<string, BudgetLevel>,
): Promise<
  Pick<BudgetsState, 'status' | 'period' | 'items' | 'error' | 'levels' | 'toast'>
> {
  try {
    const period = deps.period ?? currentPeriod();
    const [budgets, categories] = await Promise.all([
      deps.budgets.listByPeriod(period),
      deps.loadCategories?.() ?? Promise.resolve([]),
    ]);
    const names = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const usages = await Promise.all(
      budgets.map((b) => deps.budgets.usage(b.categoryId, period)),
    );
    const evaluations = evaluateBudgets(
      budgets.map((b, i) => ({
        categoryId: b.categoryId,
        period,
        spentCents: usages[i]?.spentCents ?? 0,
        budgetCents: usages[i]?.budgetCents ?? b.amountCents,
      })),
    );
    const items: BudgetRow[] = budgets.map((b, i) => ({
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: names[b.categoryId] ?? b.categoryId,
      budgetCents: evaluations[i]?.budgetCents ?? b.amountCents,
      spentCents: evaluations[i]?.spentCents ?? 0,
      ratio: evaluations[i]?.ratio ?? 0,
      level: evaluations[i]?.level ?? 'ok',
    }));
    // Alertas serenas: informa UNA vez por nivel; no repite sin cambio.
    const levels: Record<string, BudgetLevel> = {};
    let toast: BudgetAlert | null = null;
    for (const item of items) {
      const prev = prevLevels[item.categoryId];
      levels[item.categoryId] = item.level;
      if (
        (item.level === 'warn' || item.level === 'exceeded') &&
        (prev === undefined || LEVEL_RANK[item.level] > LEVEL_RANK[prev])
      ) {
        toast = {
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          period,
          ratio: item.ratio,
          level: item.level,
        };
      }
    }
    return { status: items.length === 0 ? 'empty' : 'success', period, items, error: null, levels, toast };
  } catch {
    return {
      status: 'error',
      period: deps.period ?? currentPeriod(),
      items: [],
      error: 'STORAGE_UNAVAILABLE',
      levels: prevLevels,
      toast: null,
    };
  }
}

export const useBudgetsStore = create<BudgetsState>((set, get) => ({
  status: 'loading',
  period: currentPeriod(),
  items: [],
  error: null,
  duplicate: null,
  formError: null,
  toast: null,
  deps: null,
  levels: {},

  init: async (deps) => {
    if (get().deps) return; // idempotente
    set({ deps, status: 'loading' });
    set(await loadFromRepo(deps, {}));
    deps.onTxEvent?.(() => {
      if (get().deps !== deps) return;
      void loadFromRepo(deps, get().levels).then((s) => set(s));
    });
  },

  reload: async () => {
    const { deps, levels } = get();
    if (!deps) return;
    set({ status: 'loading' });
    set(await loadFromRepo(deps, levels));
  },

  save: async (input, opts) => {
    const { deps, period, items } = get();
    if (!deps) return false;
    try {
      if (!opts?.editingCategoryId) {
        const existing = await deps.budgets.get(input.categoryId, period);
        if (existing) {
          set({
            duplicate: {
              budgetId: existing.id,
              categoryId: input.categoryId,
              categoryName:
                items.find((i) => i.categoryId === input.categoryId)?.categoryName ??
                input.categoryId,
            },
            formError: 'INTEGRITY_VIOLATION',
          });
          return false;
        }
      }
      await deps.budgets.upsert({ ...input, period });
      set({ duplicate: null, formError: null });
      set(await loadFromRepo(deps, get().levels));
      return true;
    } catch (err) {
      set({
        formError:
          err instanceof Error && err.name === 'ZodError'
            ? 'VALIDATION_FAILED'
            : 'STORAGE_UNAVAILABLE',
      });
      return false;
    }
  },

  remove: async (categoryId) => {
    const { deps, levels } = get();
    if (!deps) return false;
    try {
      await deps.budgets.remove(categoryId, deps.period ?? currentPeriod());
      set(await loadFromRepo(deps, levels));
      return true;
    } catch {
      set({ formError: 'STORAGE_UNAVAILABLE' });
      return false;
    }
  },

  clearToast: () => set({ toast: null }),
  clearDuplicate: () => set({ duplicate: null, formError: null }),
  clearFormError: () => set({ formError: null }),
}));
