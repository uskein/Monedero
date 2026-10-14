/**
 * Glifos Ionicons — utilidad de UI (v0.3.0).
 * La BD guarda el nombre del icono como texto (columna `categories.icon`,
 * DEFAULT 'tag' del 001). En Ionicons el glifo se llama `pricetag`, así que
 * se normaliza en RENDER (las filas existentes siguen viéndose) y todo
 * valor desconocido cae a `pricetag` en lugar de romper el icono.
 */
import { Ionicons } from '@expo/vector-icons';

export type GlyphName = keyof typeof Ionicons.glyphMap;

/** Icono de BD → glifo Ionicons válido (fallback 'pricetag'). */
export function glyphFor(icon: string | null | undefined): GlyphName {
  const raw = icon ?? 'tag';
  const name = raw === 'tag' ? 'pricetag' : raw;
  return (name in Ionicons.glyphMap ? name : 'pricetag') as GlyphName;
}
