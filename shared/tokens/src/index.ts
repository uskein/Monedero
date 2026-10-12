/**
 * @monedero/tokens — Clay Serenity (RN / TS side)
 * Fuente: manual-identidad-visual.md §3.1–§3.3
 * Regla: prohibido hex fuera de este módulo en UI (gate: tokens:check).
 */
import raw from './tokens.json' with { type: 'json' };

export const tokens = raw;

/** Colores claros (tema por defecto) — para React Native. */
export const csColors = {
  bgBase: raw.color.bgBase,
  surface: raw.color.surface,
  surfaceSunken: raw.color.surfaceSunken,
  primary: raw.color.primary,
  primaryHover: raw.color.primaryHover,
  primarySoft: raw.color.primarySoft,
  accent: raw.color.accent,
  accentText: raw.color.accentText,
  secondary: raw.color.secondary,
  danger: raw.color.danger,
  textPrimary: raw.color.textPrimary,
  textMuted: raw.color.textMuted,
  textOnPrimary: raw.color.textOnPrimary,
  placeholder: raw.color.placeholder,
} as const;

/** Colores oscuros (SSOT §11) — tierra profunda, nunca #000. */
export const csColorsDark = {
  bgBase: raw.colorDark.bgBase,
  surface: raw.colorDark.surface,
  surfaceSunken: raw.colorDark.surfaceSunken,
  primary: raw.colorDark.primary,
  accent: raw.colorDark.accent,
  textPrimary: raw.colorDark.textPrimary,
  textMuted: raw.colorDark.textMuted,
  danger: raw.colorDark.danger,
} as const;

export const csRadius = {
  input: raw.radius.input,
  button: raw.radius.button,
  card: raw.radius.card,
  sheet: raw.radius.sheet,
  pill: raw.radius.pill,
} as const;

export const csSpace = {
  s1: raw.space[0],
  s2: raw.space[1],
  s3: raw.space[2],
  s4: raw.space[3],
  s5: raw.space[4],
  s6: raw.space[5],
  s7: raw.space[6],
  s8: raw.space[7],
} as const;

export const csMotion = {
  /** Curva firma: cubic-bezier(.34,1.56,.64,1) → [control1x, control1y, control2x, control2y] */
  easeSpring: raw.motion.easeSpring as [number, number, number, number],
  easeOut: raw.motion.easeOut as [number, number, number, number],
  fast: raw.motion.fast,
  base: raw.motion.base,
  slow: raw.motion.slow,
  reducedMax: raw.motion.reducedMax,
} as const;

export const csZIndex = raw.zIndex;
export const csBreakpoints = raw.breakpoints;
export const csLogo = raw.logo;

export type Tokens = typeof tokens;
