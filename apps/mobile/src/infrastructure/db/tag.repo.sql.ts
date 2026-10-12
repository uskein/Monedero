/**
 * SqlTagRepository — implementación móvil sobre SqlDbPort (HU-10).
 * Nombre único NOCASE garantizado por `ux_tags_name` (001); los vínculos viven
 * en transaction_tags con ON DELETE CASCADE (borrar la etiqueta los limpia).
 */
import type { Tag, TagInput } from '../../core/domain/category';
import { TagInputSchema } from '../../core/domain/category';
import type { TagEvent, TagRepository } from '../../core/ports/TagRepository';
import type { SqlDbPort, SqlRow } from './SqlDbPort';
import { isUniqueViolation, uuid } from './sqlErrors';

interface Row extends SqlRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const SELECT_COLS = `id, name, created_at, updated_at, deleted_at`;

function toDomain(row: Row): Tag {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SqlTagRepository implements TagRepository {
  private readonly listeners = new Set<(e: TagEvent) => void>();

  constructor(private readonly db: SqlDbPort) {}

  private notify(type: TagEvent['type'], id: string): void {
    for (const cb of this.listeners) cb({ scope: 'tag', type, id });
  }

  subscribe(cb: (e: TagEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async list(): Promise<Tag[]> {
    const rows = await this.db.select<Row>(
      `SELECT ${SELECT_COLS} FROM tags WHERE deleted_at IS NULL ORDER BY name`,
    );
    return rows.map(toDomain);
  }

  async create(input: TagInput): Promise<Tag> {
    const parsed = TagInputSchema.parse(input); // Zod ANTES de persistir
    const now = new Date().toISOString();
    const id = uuid();
    try {
      await this.db.run(
        'INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [id, parsed.name, now, now],
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('INTEGRITY_VIOLATION');
      throw err;
    }
    this.notify('tag:created', id);
    const rows = await this.db.select<Row>(`SELECT ${SELECT_COLS} FROM tags WHERE id = ?`, [id]);
    const created = rows[0];
    if (!created) throw new Error('TAG_NOT_PERSISTED');
    return toDomain(created);
  }

  async remove(id: string): Promise<void> {
    await this.db.run('DELETE FROM tags WHERE id = ?', [id]);
    this.notify('tag:removed', id);
  }
}
