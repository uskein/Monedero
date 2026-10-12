/**
 * SqlCategoryRepository — implementación móvil sobre SqlDbPort (HU-10).
 * Semántica idéntica al repositorio de la PWA. La unicidad NOCASE la garantiza
 * `ux_categories_name` (migración 002): la violación SQL se traduce a
 * INTEGRITY_VIOLATION de dominio. Archivar = tombstone (libera el nombre);
 * borrar = físico y solo sin referencias (con movimientos se archiva, HU-10).
 */
import type { Category, CategoryInput, CategoryPatch, CategoryType } from '../../core/domain/category';
import { CategoryInputSchema, CategoryPatchSchema } from '../../core/domain/category';
import type { CategoryEvent, CategoryRepository } from '../../core/ports/CategoryRepository';
import type { SqlDbPort, SqlRow } from './SqlDbPort';
import { isUniqueViolation, uuid } from './sqlErrors';

interface Row extends SqlRow {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const SELECT_COLS = `id, name, type, parent_id, icon, color, sort_order, created_at, updated_at, deleted_at`;

function toDomain(row: Row): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Category['type'],
    parentId: row.parent_id,
    icon: row.icon,
    color: row.color,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SqlCategoryRepository implements CategoryRepository {
  private readonly listeners = new Set<(e: CategoryEvent) => void>();

  constructor(private readonly db: SqlDbPort) {}

  private notify(type: CategoryEvent['type'], id: string): void {
    for (const cb of this.listeners) cb({ scope: 'category', type, id });
  }

  subscribe(cb: (e: CategoryEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async list(opts: { type?: CategoryType; includeArchived?: boolean } = {}): Promise<Category[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (!opts.includeArchived) where.push('deleted_at IS NULL');
    if (opts.type) {
      where.push('type = ?');
      params.push(opts.type);
    }
    const sql = `SELECT ${SELECT_COLS} FROM categories
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sort_order, name`;
    const rows = await this.db.select<Row>(sql, params);
    return rows.map(toDomain);
  }

  async getById(id: string): Promise<Category | null> {
    const rows = await this.db.select<Row>(`SELECT ${SELECT_COLS} FROM categories WHERE id = ?`, [id]);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async create(input: CategoryInput): Promise<Category> {
    const parsed = CategoryInputSchema.parse(input); // Zod ANTES de persistir
    const now = new Date().toISOString();
    const id = uuid();
    try {
      await this.db.run(
        `INSERT INTO categories (id, name, type, parent_id, icon, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, parsed.name, parsed.type, parsed.parentId ?? null, parsed.icon ?? 'tag', parsed.color ?? '#3D5A80', now, now],
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('INTEGRITY_VIOLATION');
      throw err;
    }
    this.notify('category:created', id);
    const created = await this.getById(id);
    if (!created) throw new Error('CATEGORY_NOT_PERSISTED');
    return created;
  }

  async update(id: string, patch: CategoryPatch): Promise<Category> {
    const parsed = CategoryPatchSchema.parse(patch);
    const existing = await this.getById(id);
    if (!existing || existing.deletedAt) throw new Error('CATEGORY_NOT_FOUND');

    const now = new Date().toISOString();
    try {
      await this.db.run(
        `UPDATE categories SET name = ?, icon = ?, color = ?, parent_id = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`,
        [
          parsed.name ?? existing.name,
          parsed.icon ?? existing.icon,
          parsed.color ?? existing.color,
          parsed.parentId !== undefined ? parsed.parentId : existing.parentId,
          parsed.sortOrder ?? existing.sortOrder,
          now,
          id,
        ],
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('INTEGRITY_VIOLATION');
      throw err;
    }
    this.notify('category:updated', id);
    const updated = await this.getById(id);
    if (!updated) throw new Error('CATEGORY_NOT_PERSISTED');
    return updated;
  }

  /** Tombstone: conserva la fila (se exporta para propagar el archivado). */
  async archive(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    this.notify('category:archived', id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing || existing.deletedAt) throw new Error('CATEGORY_NOT_FOUND');
    try {
      // FK (movimientos, hijos o presupuestos) bloquea el físico → archivar.
      await this.db.run('DELETE FROM categories WHERE id = ? AND deleted_at IS NULL', [id]);
    } catch {
      throw new Error('INTEGRITY_VIOLATION');
    }
    this.notify('category:removed', id);
  }
}
