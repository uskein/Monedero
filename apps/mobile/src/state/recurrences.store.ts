/**
 * Recurrences store (móvil) — v0.3.0 «movimientos mensuales».
 * Regla money-critical: la app PROPONE y el usuario CONFIRMA — `generate`
 * solo actúa bajo petición explícita (nunca automático). El ancla
 * `lastGeneratedPeriod` hace la operación idempotente por mes; la transacción
 * generada se registra vía el MISMO repo de movimientos (evento → stores
 * suscritos como cualquier alta manual). Init idempotente (espejo de los
 * demás stores); repo y txRepo se inyectan (hexagonal).
 */
import { create } from 'zustand';
import {
  buildGeneratedTxInput,
  isPendingFor,
  type Recurrence,
  type RecurrenceInput,
} from '../core/domain/recurrence';
import type { RecurrenceRepository } from '../core/ports/RecurrenceRepository';
import type { TransactionRepository } from '../core/ports/TransactionRepository';
import { useTransactionsStore } from './transactions.store';

export type RecurrencesStatus = 'loading' | 'empty' | 'success' | 'error';

/** Fecha local YYYY-MM-DD (nunca UTC: el corte de día no debe derivar). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface RecurrencesState {
  status: RecurrencesStatus;
  items: Recurrence[];
  /** DomainErrorCode → messageKey i18n en UI. */
  error: string | null;
  repo: RecurrenceRepository | null;
  txRepo: TransactionRepository | null;

  init: (repo: RecurrenceRepository, txRepo?: TransactionRepository) => Promise<void>;
  reload: () => Promise<void>;
  /** Crea la regla y ancla `seedPeriod` (alta desde el formulario). */
  createSeeded: (input: RecurrenceInput, seedPeriod: string) => Promise<boolean>;
  setActive: (id: string, active: boolean) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Genera el movimiento del periodo ACTUAL para esa regla (confirmación). */
  generate: (id: string) => Promise<boolean>;
  /** Genera todas las pendientes del periodo actual. Devuelve cuántas. */
  generateAll: () => Promise<number>;
  clearError: () => void;
}

async function loadFromRepo(
  repo: RecurrenceRepository,
): Promise<Pick<RecurrencesState, 'status' | 'items' | 'error'>> {
  try {
    const items = await repo.list();
    return { status: items.length === 0 ? 'empty' : 'success', items, error: null };
  } catch {
    return { status: 'error', items: [], error: 'STORAGE_UNAVAILABLE' };
  }
}

export const useRecurrencesStore = create<RecurrencesState>((set, get) => ({
  status: 'loading',
  items: [],
  error: null,
  repo: null,
  txRepo: null,

  init: async (repo, txRepo) => {
    if (get().repo) return; // idempotente
    set({ repo, txRepo: txRepo ?? null, status: 'loading' });
    set(await loadFromRepo(repo));
  },

  reload: async () => {
    const { repo } = get();
    if (!repo) return;
    set({ status: 'loading' });
    set(await loadFromRepo(repo));
  },

  createSeeded: async (input, seedPeriod) => {
    const { repo } = get();
    if (!repo) return false;
    try {
      const created = await repo.create(input);
      await repo.markGenerated(created.id, seedPeriod);
      set(await loadFromRepo(repo));
      return true;
    } catch {
      set({ error: 'VALIDATION_FAILED' });
      return false;
    }
  },

  setActive: async (id, active) => {
    const { repo } = get();
    if (!repo) return false;
    try {
      await repo.update(id, { active });
      set(await loadFromRepo(repo));
      return true;
    } catch {
      set({ error: 'STORAGE_UNAVAILABLE' });
      return false;
    }
  },

  remove: async (id) => {
    const { repo } = get();
    if (!repo) return false;
    try {
      await repo.remove(id);
      set(await loadFromRepo(repo));
      return true;
    } catch {
      set({ error: 'STORAGE_UNAVAILABLE' });
      return false;
    }
  },

  generate: async (id) => {
    const { repo, txRepo, items } = get();
    if (!repo || !txRepo) return false;
    const rec = items.find((r) => r.id === id);
    if (!rec) return false;
    const today = todayIso();
    const period = today.slice(0, 7);
    if (!isPendingFor(rec, period, today)) return true; // ya generada o pausada
    try {
      // 1) alta del movimiento con el MISMO repo normal → eventos y snapshot.
      await txRepo.create(buildGeneratedTxInput(rec, period, today));
      // 2) ancla idempotente: si ya estaba generada, no se duplica.
      await repo.markGenerated(id, period);
      set(await loadFromRepo(repo));
      await useTransactionsStore.getState().reload();
      return true;
    } catch {
      set({ error: 'STORAGE_UNAVAILABLE' });
      return false;
    }
  },

  generateAll: async () => {
    const { repo, txRepo, items } = get();
    if (!repo || !txRepo) return 0;
    const today = todayIso();
    const period = today.slice(0, 7);
    let count = 0;
    for (const rec of items) {
      if (!isPendingFor(rec, period, today)) continue;
      try {
        await txRepo.create(buildGeneratedTxInput(rec, period, today));
        await repo.markGenerated(rec.id, period);
        count += 1;
      } catch {
        set({ error: 'STORAGE_UNAVAILABLE' });
        break;
      }
    }
    set(await loadFromRepo(repo));
    if (count > 0) await useTransactionsStore.getState().reload();
    return count;
  },

  clearError: () => set({ error: null }),
}));
