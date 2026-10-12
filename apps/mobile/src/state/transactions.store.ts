/**
 * Transactions store (Zustand móvil) — FLUX BP-04/BP-05.
 * Fuente: CONTRATOS_API.md §1.1 (puerto) · BLUEPRINTS BP-04/BP-05.
 * 4 estados obligatorios: loading | empty | success | error.
 * El repo se inyecta (hexagonal) para testear el store sin tocar la UI ni sql.js.
 */
import { create } from 'zustand';
import type { Transaction, TxFilter, TxInput } from '../core/domain/transaction';
import type { TransactionRepository } from '../core/ports/TransactionRepository';

export type TxListStatus = 'loading' | 'empty' | 'success' | 'error';

interface TransactionsState {
  status: TxListStatus;
  items: Transaction[];
  filter: TxFilter;
  /** DomainErrorCode | null → messageKey i18n en UI. */
  error: string | null;
  /** id del último borrado (para Deshacer 4 s). */
  lastDeletedId: string | null;
  repo: TransactionRepository | null;

  init: (repo: TransactionRepository) => Promise<void>;
  reload: () => Promise<void>;
  setFilter: (patch: Partial<TxFilter>) => void;
  add: (input: TxInput) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  undoDelete: () => Promise<void>;
  clearUndo: () => void;
}

async function loadFromRepo(
  repo: TransactionRepository,
  filter: TxFilter,
): Promise<Pick<TransactionsState, 'status' | 'items' | 'error'>> {
  try {
    const items = await repo.list(filter);
    return { status: items.length === 0 ? 'empty' : 'success', items, error: null };
  } catch {
    return { status: 'error', items: [], error: 'STORAGE_UNAVAILABLE' };
  }
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  status: 'loading',
  items: [],
  filter: {},
  error: null,
  lastDeletedId: null,
  repo: null,

  init: async (repo) => {
    if (get().repo) return; // idempotente
    set({ repo, status: 'loading' });
    set(await loadFromRepo(repo, get().filter));
  },

  reload: async () => {
    const { repo, filter } = get();
    if (!repo) return;
    set({ status: 'loading' });
    set(await loadFromRepo(repo, filter));
  },

  setFilter: async (patch) => {
    const filter = { ...get().filter, ...patch };
    set({ filter });
    const { repo } = get();
    if (!repo) return;
    set(await loadFromRepo(repo, filter));
  },

  add: async (input) => {
    const { repo } = get();
    if (!repo) return false;
    try {
      await repo.create(input);
      set(await loadFromRepo(repo, get().filter));
      return true;
    } catch {
      set({ error: 'VALIDATION_FAILED' });
      return false;
    }
  },

  remove: async (id) => {
    const { repo } = get();
    if (!repo) return;
    try {
      await repo.softDelete(id);
      set({ lastDeletedId: id });
      set(await loadFromRepo(repo, get().filter));
    } catch {
      set({ error: 'STORAGE_UNAVAILABLE' });
    }
  },

  undoDelete: async () => {
    const { repo, lastDeletedId } = get();
    if (!repo || !lastDeletedId) return;
    try {
      await repo.restore(lastDeletedId);
      set({ lastDeletedId: null });
      set(await loadFromRepo(repo, get().filter));
    } catch {
      set({ error: 'STORAGE_UNAVAILABLE' });
    }
  },

  clearUndo: () => set({ lastDeletedId: null }),
}));
