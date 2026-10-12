/**
 * Puerto TagRepository (HU-10) — móvil. Fuente: CONTRATOS_API.md §1.2.
 * Nombre único NOCASE (ux_tags_name); los vínculos se borran en cascada.
 */
import type { Tag, TagInput } from '../domain/category';

export type Unsubscribe = () => void;

export type TagEvent = {
  scope: 'tag';
  type: 'tag:created' | 'tag:removed';
  id: string;
};

export interface TagRepository {
  list(): Promise<Tag[]>;
  /** Nombre duplicado NOCASE → INTEGRITY_VIOLATION. */
  create(input: TagInput): Promise<Tag>;
  remove(id: string): Promise<void>;
  subscribe(cb: (e: TagEvent) => void): Unsubscribe;
}
