/**
 * Dashboard store (Zustand) — BP-03 (HU-08·09·12).
 * Fuente: BLUEPRINTS_DE_PANTALLAS.md BP-03 · tarea 4.3 (sincronía tx:created → balance).
 * Estados obligatorios (DoD): loading | empty | success | error.
 * Se suscribe al repo (la MISMA instancia que usa la lista de movimientos) y
 * recarga el resumen ante cada cambio scope='tx': así cualquier alta/borrado/
 * deshacer actualiza el balance sin acoplar stores.
 */
import { create } from 'zustand';
import { monthKeyOf } from '@monedero/i18n';
import type { DashboardSummary, Transaction, TxFilter } from '../../data/domain/transactions';

/** Puerto mínimo que consume el dashboard (ISP): resumen + últimos + eventos. */
export interface DashboardRepo {
  dashboardSummary(month: string): Promise<DashboardSummary>;
  list(filter: TxFilter): Promise<Transaction[]>;
  subscribe(cb: (changed: { scope: 'tx' | 'account' | 'category' }) => void): () => void;
}

export type DashboardStatus = 'loading' | 'empty' | 'success' | 'error';

/** Cuántos movimientos recientes muestra BP-03. */
export const LATEST_LIMIT = 5;

interface DashboardState {
  status: DashboardStatus;
  /** Periodo 'YYYY-MM' seleccionado en el segmented. */
  month: string;
  summary: DashboardSummary | null;
  /** Últimos movimientos (sin filtros de la lista BP-04). */
  latest: Transaction[];
  /** DomainErrorCode | null → messageKey en UI */
  error: string | null;
  repo: DashboardRepo | null;
  /** Inyecta el repo, se suscribe a cambios 'tx' y carga (idempotente). */
  init: (repo: DashboardRepo) => Promise<void>;
  /** Cambia el periodo del segmented y recarga el resumen. */
  setMonth: (month: string) => Promise<void>;
  /** Recarga bajo demanda (retry). */
  refresh: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => {
  let unsubscribe: (() => void) | null = null;
  /** Secuencia de cargas: descarta respuestas obsoletas (una carga posterior gana). */
  let seq = 0;

  async function load(opts: { showLoading: boolean }): Promise<void> {
    const repo = get().repo;
    if (!repo) return;
    const id = ++seq;
    if (opts.showLoading) set({ status: 'loading' });
    try {
      const month = get().month;
      const [summary, latest] = await Promise.all([
        repo.dashboardSummary(month),
        repo.list({ limit: LATEST_LIMIT }),
      ]);
      if (id !== seq) return; // carrera: otra carga posterior ya pasó
      set({ summary, latest, status: latest.length === 0 ? 'empty' : 'success', error: null });
    } catch {
      if (id !== seq) return;
      set({ summary: null, latest: [], status: 'error', error: 'STORAGE_UNAVAILABLE' });
    }
  }

  return {
    status: 'loading',
    month: monthKeyOf(new Date()),
    summary: null,
    latest: [],
    error: null,
    repo: null,

    init: async (repo) => {
      if (get().repo) return; // idempotente (mismo patrón que el store de lista)
      set({ repo, status: 'loading' });
      unsubscribe?.(); // limpieza defensiva si re-init tras reset (tests)
      unsubscribe = repo.subscribe((changed) => {
        // Tarea 4.3: tx:created/updated/deleted/restored → refresca balance.
        if (changed.scope === 'tx') void load({ showLoading: false });
      });
      await load({ showLoading: false });
    },

    setMonth: async (month) => {
      if (!get().repo) {
        set({ month });
        return;
      }
      set({ month });
      await load({ showLoading: false });
    },

    refresh: () => load({ showLoading: true }),
  };
});

/** Solo tests: limpia suscripción y estado entre casos. */
export function resetDashboardStore(): void {
  useDashboardStore.setState({
    status: 'loading',
    month: monthKeyOf(new Date()),
    summary: null,
    latest: [],
    error: null,
    repo: null,
  });
}
