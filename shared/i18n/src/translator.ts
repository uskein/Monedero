/**
 * Traductor core — sin dependencias de UI (funciona en web y RN).
 * Reglas ESTANDAR_INTERNACIONALIZACION.md:
 *  - fallback a es-CO si falta una clave
 *  - interpolación {var}
 *  - detecta claves no usadas en CI (gate i18n)
 */
import { esCO, type TranslationKey, type Dictionary } from './locales/es-CO';
import { enUS } from './locales/en-US';

export type Locale = 'es-CO' | 'en-US';

export const DICTIONARIES: Record<Locale, Dictionary> = {
  'es-CO': esCO,
  'en-US': enUS,
};

export type TParams = Record<string, string | number>;

/** Interpola {var} en la plantilla. */
function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export type TFunction = (key: TranslationKey, params?: TParams) => string;

/** Crea un t() para un locale; fallback a es-CO, y a la propia clave si falta. */
export function createTranslator(locale: Locale): TFunction {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES['es-CO'];
  const fallback = DICTIONARIES['es-CO'];
  return (key, params) => {
    const template = dict[key] ?? fallback[key] ?? key;
    return interpolate(template, params);
  };
}

/** Locale del dispositivo (navegador/RN), con fallback es-CO. */
export function detectLocale(navigatorLanguages?: readonly string[]): Locale {
  const langs = navigatorLanguages ?? [];
  for (const lang of langs) {
    if (lang.toLowerCase().startsWith('en')) return 'en-US';
    if (lang.toLowerCase().startsWith('es')) return 'es-CO';
  }
  return 'es-CO';
}

export type { TranslationKey, Dictionary };
export { esCO, enUS };
