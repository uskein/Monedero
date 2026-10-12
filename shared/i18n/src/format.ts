/**
 * formatMoney — ÚNICO módulo de formateo monetario (HU-18, decisión del proyecto).
 * Reglas:
 *  - COP: 0 decimales · USD/EUR: 2 decimales
 *  - formateo regional según locale (es-CO → punto miles coma decimal; en-US → coma miles)
 *  - NO convierte monedas: la moneda es la de la cuenta (formatting only)
 *  - importes internos SIEMPRE en centavos enteros
 */
import type { Locale } from './translator';

export type CurrencyCode = 'COP' | 'USD' | 'EUR';

/** Decimales por moneda (regla de negocio HU-18). */
export function decimalsFor(currency: CurrencyCode): number {
  return currency === 'COP' ? 0 : 2;
}

/** Símbolo visible por moneda (no depende del locale: $ / US$ / €). */
export function symbolFor(currency: CurrencyCode): string {
  switch (currency) {
    case 'COP':
      return '$';
    case 'USD':
      return 'US$';
    case 'EUR':
      return '€';
  }
}

interface FormatOptions {
  /** Incluir símbolo (por defecto sí) */
  withSymbol?: boolean;
  /** Forzar signo +/− (por defecto solo negativos llevan −) */
  signDisplay?: 'auto' | 'always' | 'never';
}

/**
 * Formatea centavos a texto regional.
 * @param cents importe en centavos enteros (negativo = gasto)
 */
export function formatMoney(
  cents: number,
  currency: CurrencyCode,
  locale: Locale,
  options: FormatOptions = {},
): string {
  const { withSymbol = true, signDisplay = 'auto' } = options;
  const decimals = decimalsFor(currency);
  // Dividimos ya: COP tiene 0 decimales, así que centavos → unidades directo.
  const major = cents / 100;

  const intlLocale = locale === 'es-CO' ? 'es-CO' : 'en-US';
  const formatter = new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay,
  });

  const text = formatter.format(major);
  if (withSymbol) return text;

  // Sin símbolo: elimina el símbolo de moneda dejando el número con signo.
  return text.replace(/[^\d\-+.,\s \s]/g, '').trim();
}

/** Importe con signo explícito para filas de movimiento (+ingreso / −gasto). */
export function formatMoneySigned(
  cents: number,
  currency: CurrencyCode,
  locale: Locale,
  isIncome: boolean,
): string {
  const abs = formatMoney(Math.abs(cents), currency, locale);
  return isIncome ? `+ ${abs}` : `− ${abs}`;
}

/**
 * Parsea la entrada decimal del usuario a centavos enteros (contrario de formatMoney).
 * ÚNICA regla compartida por PWA y móvil (HU-18: sin drift entre plataformas).
 * Heurística por el ÚLTIMO separador (punto o coma):
 *  - 1–2 dígitos tras él ⇒ es decimal → "18.500,50" y "18,500.50" dan 1 850 050;
 *  - 3+ dígitos ⇒ es de miles → "18.500" da 1 850 000;
 *  - sin separador ⇒ unidades enteras → "25000" da 2 500 000.
 * Siempre devuelve entero (sin flotantes); null si no es parseable.
 */
export function parseAmountToCents(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '');
  if (normalized === '') return null;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  let decimalSep = -1;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = Math.max(lastComma, lastDot); // dos separadores: el último es decimal
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = Math.max(lastComma, lastDot);
    const digitsAfter = normalized.length - sep - 1;
    decimalSep = digitsAfter >= 1 && digitsAfter <= 2 ? sep : -1;
  }

  let major: string;
  let minor = '';
  if (decimalSep >= 0) {
    major = normalized.slice(0, decimalSep).replace(/[.,]/g, '');
    minor = normalized.slice(decimalSep + 1);
  } else {
    major = normalized.replace(/[.,]/g, '');
  }
  if (!/^\d*$/.test(major) || !/^\d*$/.test(minor)) return null;
  if (major === '' && minor === '') return null;

  const cents = Number(major || '0') * 100 + Number(`${minor}00`.slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}
