/**
 * Reports store (móvil) — BP-07 · HU-13 (tarea 6.2).
 * Carga los movimientos del mes seleccionado y agrega con computeMonthReport
 * (dominio puro TDD 6.1). Se reevalúa ante eventos de movimientos (F3 sync).
 * Estados DoD: loading | empty | success | error.
 */
import { create } from 'zustand';
import { monthKeyOf } from '@monedero/i18n';
import { computeMonthReport, type MonthReport, type MonthReportTx } from '../core/domain/monthReport';

/** Puerto mínimo: el repo real de movimientos cumple esta forma. */
export interface ReportsRepo {
  list(filter?: Record<string, unknown>): Promise<MonthReportTx[]>;
  /** Suscripción a cambios (opcional; el repo real la expone). */
  subscribe?(cb: (changed: { scope: string }) => void): () => void;
}

export type ReportsStatus = 'loading' | 'empty' | 'success' | 'error';

/** Movimiento del mes con lo necesario para la tabla de exportación. */
export interface ReportTx {
  type: 'income' | 'expense' | 'transfer';
  amountCents: number;
  categoryId: string | null;
  date: string;
  deletedAt: string | null;
  payee?: string | null;
  note?: string | null;
}

interface ReportsState {
  month: string;
  status: ReportsStatus;
  report: MonthReport | null;
  /** Todos los movimientos del mes (para la tabla del PDF, HU-13). */
  transactions: ReportTx[];
  error: string | null;
  repo: ReportsRepo | null;

  init: (repo: ReportsRepo) => Promise<void>;
  setMonth: (month: string) => Promise<void>;
}

async function recompute(
  repo: ReportsRepo,
  month: string,
): Promise<Pick<ReportsState, 'status' | 'report' | 'transactions' | 'error'>> {
  try {
    const txs = await repo.list({});
    const report = computeMonthReport(month, txs);
    const transactions = txs.filter((tx) => !tx.deletedAt && tx.date.slice(0, 7) === month);
    const isEmpty = report.expenseCents === 0 && report.incomeCents === 0;
    return { status: isEmpty ? 'empty' : 'success', report, transactions, error: null };
  } catch {
    return { status: 'error', report: null, transactions: [], error: 'STORAGE_UNAVAILABLE' };
  }
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  month: monthKeyOf(new Date()),
  status: 'loading',
  report: null,
  transactions: [],
  error: null,
  repo: null,

  init: async (repo) => {
    if (get().repo) return; // idempotente
    set({ repo, status: 'loading' });
    set(await recompute(repo, get().month));
    repo.subscribe?.(() => {
      if (get().repo !== repo) return;
      void recompute(repo, get().month).then((s) => set(s));
    });
  },

  setMonth: async (month) => {
    const { repo } = get();
    set({ month, status: 'loading' });
    if (!repo) return;
    set(await recompute(repo, month));
  },
}));
