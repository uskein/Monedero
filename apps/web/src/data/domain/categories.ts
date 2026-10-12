/**
 * Categoría y Tag — dominio PWA (HU-10 · E5).
 * Espejo de apps/mobile/src/core/domain/category.ts. Fuente: MODELO_DE_DATOS §3.
 * Reglas: nombre 1..50 (único NOCASE en BD vía 002 → duplicado =
 * INTEGRITY_VIOLATION), tipo income|expense, jerarquía por parentId (self-ref),
 * archivado = tombstone (una categoría con movimientos se archiva, no se borra).
 * El color se restringe a tokens --cs-* en la UI (criterio HU-10).
 */
import { z } from 'zod';

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Tombstone: filtra las vistas pero se exporta (MODELO §5). */
  deletedAt: string | null;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  parentId?: string | null;
  icon?: string;
  color?: string;
}

export interface CategoryPatch {
  name?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  parentId?: string | null;
}

export const CategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'VALIDATION_FAILED')
    .max(50, 'VALIDATION_FAILED'),
  type: z.enum(['income', 'expense']),
  parentId: z.string().min(1).nullable().optional(),
  icon: z.string().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'VALIDATION_FAILED')
    .optional(),
});

export const CategoryPatchSchema = CategoryInputSchema.pick({
  name: true,
  icon: true,
  color: true,
  parentId: true,
})
  .partial()
  .extend({ sortOrder: z.number().int().min(0).optional() });

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TagInput {
  name: string;
}

export const TagInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'VALIDATION_FAILED')
    .max(30, 'VALIDATION_FAILED'),
});
