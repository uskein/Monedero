/**
 * Categories store (Zustand) — FLUX BP-08 sub Categorías · HU-10.
 * Fuente: CONTRATOS_API.md §1.2 (puerto CategoryRepository) · HU-10 (unicidad
 * NOCASE, archivado en lugar de borrar con movimientos).
 * Estados obligatorios: loading | empty | success | error.
 * El repo se inyecta (getCategoriesRepo → SqlJsCategoryRepository) para
 * testear el store con un repo en memoria sin tocar sql.js.
 */
import { create } from 'zustand';
import type { Category, CategoryInput, CategoryPatch } from '../../data/domain/categories';

/** Puerto mínimo que consume el store (misma semántica que el repo real). */
export interface CategoriesRepo {
  list(opts?: { includeArchived?: boolean }): Promise<Category[]>;
  create(input: CategoryInput): Promise<Category>;
  update(id: string, patch: CategoryPatch): Promise<Category>;
  archive(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(cb: (e: { type: string }) => void): () => void;
}

export type CategoriesStatus = 'loading' | 'empty' | 'success' | 'error';

/** Traduce el error a código de dominio para messageKey en UI. */
export function categoriesErrorCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg === 'INTEGRITY_VIOLATION') return 'INTEGRITY_VIOLATION';
  if (err instanceof Error && err.name === 'ZodError') return 'VALIDATION_FAILED';
  return 'STORAGE_UNAVAILABLE';
}

interface CategoriesState {
  status: CategoriesStatus;
  items: Category[];
  /** DomainErrorCode | null → messageKey en UI */
  error: string | null;
  /** Código de dominio del último alta/edición/borrado fallido. */
  formError: string | null;
  repo: CategoriesRepo | null;

  /** Inyecta el repo y carga la lista (una sola vez por sesión). */
  init: (repo: CategoriesRepo) => Promise<void>;
  reload: () => Promise<void>;
  create: (input: CategoryInput) => Promise<boolean>;
  update: (id: string, patch: CategoryPatch) => Promise<boolean>;
  archive: (id: string) => Promise<void>;
  /** Borrado físico: con movimientos → INTEGRITY_VIOLATION (se archiva). */
  remove: (id: string) => Promise<boolean>;
  clearFormError: () => void;
}

async function loadFromRepo(
  repo: CategoriesRepo,
): Promise<Pick<CategoriesState, 'status' | 'items' | 'error'>> {
  try {
    const items = await repo.list();
    return { status: items.length === 0 ? 'empty' : 'success', items, error: null };
  } catch {
    return { status: 'error', items: [], error: 'STORAGE_UNAVAILABLE' };
  }
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  status: 'loading',
  items: [],
  error: null,
  formError: null,
  repo: null,

  init: async (repo) => {
    if (get().repo) return; // idempotente
    set({ repo, status: 'loading' });
    set(await loadFromRepo(repo));
    // Cambios desde OTRA pantalla (alta desde el formulario de movimientos…).
    repo.subscribe(() => {
      if (get().repo === repo) void loadFromRepo(repo).then((s) => set(s));
    });
  },

  reload: async () => {
    const { repo } = get();
    if (!repo) return;
    set({ status: 'loading' });
    set(await loadFromRepo(repo));
  },

  create: async (input) => {
    const { repo } = get();
    if (!repo) return false;
    try {
      await repo.create(input);
      set({ formError: null });
      set(await loadFromRepo(repo));
      return true;
    } catch (err) {
      set({ formError: categoriesErrorCode(err) });
      return false;
    }
  },

  update: async (id, patch) => {
    const { repo } = get();
    if (!repo) return false;
    try {
      await repo.update(id, patch);
      set({ formError: null });
      set(await loadFromRepo(repo));
      return true;
    } catch (err) {
      set({ formError: categoriesErrorCode(err) });
      return false;
    }
  },

  archive: async (id) => {
    const { repo } = get();
    if (!repo) return;
    await repo.archive(id);
    set(await loadFromRepo(repo));
  },

  remove: async (id) => {
    const { repo } = get();
    if (!repo) return false;
    try {
      await repo.remove(id);
      set({ formError: null });
      set(await loadFromRepo(repo));
      return true;
    } catch (err) {
      set({ formError: categoriesErrorCode(err) });
      return false;
    }
  },

  clearFormError: () => set({ formError: null }),
}));
