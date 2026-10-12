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
