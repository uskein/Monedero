/**
 * Puerto CategoryRepository (HU-10) — móvil.
 * Fuente: CONTRATOS_API.md §1.2 · MODELO_DE_DATOS §3. El driver real es
 * SQLCipher (prod) / sql.js (dev-test); el puerto no conoce el motor.
 * Semántica: el nombre único NOCASE lo garantiza la BD (002) y la violación
 * se traduce a INTEGRITY_VIOLATION de dominio (nunca errores crudos de SQLite).
 */
import type { Category, CategoryInput, CategoryPatch, CategoryType } from '../domain/category';

export type Unsubscribe = () => void;

export type CategoryEvent = {
  scope: 'category';
  type: 'category:created' | 'category:updated' | 'category:archived' | 'category:removed';
  id: string;
};

export interface CategoryRepository {
  list(opts?: { type?: CategoryType; includeArchived?: boolean }): Promise<Category[]>;
  getById(id: string): Promise<Category | null>;
  /** Nombre duplicado NOCASE entre activas → INTEGRITY_VIOLATION. */
  create(input: CategoryInput): Promise<Category>;
  update(id: string, patch: CategoryPatch): Promise<Category>;
  /** Archivar (tombstone): siempre permitido; libera el nombre único. */
  archive(id: string): Promise<void>;
  /** Borrado físico: solo sin movimientos/hijos/presupuestos; si no, INTEGRITY_VIOLATION (se archiva). */
  remove(id: string): Promise<void>;
  subscribe(cb: (e: CategoryEvent) => void): Unsubscribe;
}
