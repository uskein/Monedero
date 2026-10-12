/**
 * TagRepository — implementación sql.js (PWA, HU-10).
 * Puerto: CONTRATOS_API.md §1.2 · Semántica idéntica al repositorio móvil.
 * Nombre único NOCASE (ux_tags_name); los vínculos se borran en cascada.
 */
import type { Database } from 'sql.js';
import type { Tag, TagInput } from '../domain/categories';
import { TagInputSchema } from '../domain/categories';
import { isUniqueViolation, uuid } from './sqlErrors';

type Unsubscribe = () => void;
type TagEventType = 'tag:created' | 'tag:removed';

interface Row {
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

export class SqlJsTagRepository {
  private readonly listeners = new Set<(e: { type: TagEventType }) => void>();

  constructor(private readonly db: Database) {}

  private notify(type: TagEventType): void {
    for (const cb of this.listeners) cb({ type });
  }

  subscribe(cb: (e: { type: TagEventType }) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async list(): Promise<Tag[]> {
    const stmt = this.db.prepare(`SELECT ${SELECT_COLS} FROM tags WHERE deleted_at IS NULL ORDER BY name`);
    try {
      const out: Tag[] = [];
      while (stmt.step()) out.push(toDomain(stmt.getAsObject() as unknown as Row));
      return out;
    } finally {
      stmt.free();
    }
  }

  async create(input: TagInput): Promise<Tag> {
    const parsed = TagInputSchema.parse(input); // Zod ANTES de persistir
    const now = new Date().toISOString();
    const id = uuid();
    try {
      this.db.run('INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
        id,
        parsed.name,
        now,
        now,
      ]);
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error('INTEGRITY_VIOLATION');
      throw err;
    }
    this.notify('tag:created');
    const stmt = this.db.prepare(`SELECT ${SELECT_COLS} FROM tags WHERE id = ?`);
    try {
      stmt.bind([id]);
      if (!stmt.step()) throw new Error('TAG_NOT_PERSISTED');
      return toDomain(stmt.getAsObject() as unknown as Row);
    } finally {
      stmt.free();
    }
  }

  async remove(id: string): Promise<void> {
    this.db.run('DELETE FROM tags WHERE id = ?', [id]);
    this.notify('tag:removed');
  }
}
