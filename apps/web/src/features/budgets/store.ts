/**
 * Budgets store (Zustand) — FLUX BP-06 · HU-11·12 (tarea 5.3, TDD).
 * Carga los topes del mes, calcula el uso (gastos del periodo) y evalúa los
 * umbrales serenos con evaluateBudgets (80 % warn · 100 % exceeded).
 * Al cruzar un umbral emite `budget:exceeded` → toast sereno de 4000 ms.
 * F4 «duplicado → editar existente»: save() previene el slot ocupado (el
 * upsert del repo es idempotente, pero la UI debe ofrecer editar, no
 * sobrescribir en silencio).
 */
import { create } from 'zustand';
import {
  currentPeriod,
  evaluateBudgets,
  type Budget,
  type BudgetInput,
  type BudgetLevel,
} from '../../data/domain/budgets';

/** Puerto mínimo que consume el store (misma semántica que el repo real). */
export interface BudgetsRepo {
  get(categoryId: string, period: string): Promise<Budget | null>;
  listByPeriod(period: string): Promise<Budget[]>;
  upsert(input: BudgetInput): Promise<Budget>;
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
  /** Slot ocupado detectado al guardar (F4 → «editar existente»). */
  duplicate: { budgetId: string; categoryId: string; categoryName: string } | null;
  formError: string | null;
  toast: BudgetAlert | null;
  deps: BudgetsDeps | null;
  levels: Record<string, BudgetLevel>;

  init: (deps: BudgetsDeps) => Promise<void>;
  reload: () => Promise<void>;
  /**
   * Crea o edita el tope del mes. En alta sobre slot ocupado → false + duplicate
   * (INTEGRITY_VIOLATION en UI); amountCents ≤ 0 → Zod del repo → VALIDATION_FAILED.
   */
  save: (
    input: { categoryId: string; amountCents: number },
    opts?: { editingCategoryId?: string },
  ) => Promise<boolean>;
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
    // Alertas serenas: informa UNA vez por nivel (cruce o primera carga ya
    // sobre el umbral); no repite en cada reevaluación sin cambio.
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

  clearToast: () => set({ toast: null }),
  clearDuplicate: () => set({ duplicate: null, formError: null }),
  clearFormError: () => set({ formError: null }),
}));
