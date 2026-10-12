/**
 * MoneyCents — tipo branded para dinero en centavos enteros (ADR: sin flotantes).
 * Fuente: MODELO_DE_DATOS.md (amount_cents INTEGER) · HU-18 (COP 0 dec / USD·EUR 2 dec).
 * TDD estricto (ESTRATEGIA_PRUEBAS §5): dinero es área crítica.
 */

export type MoneyCents = number & { readonly __brand: 'MoneyCents' };

/** Crea un MoneyCents validando que sea entero. Lanza si no es entero. */
export function moneyCents(amount: number): MoneyCents {
  if (!Number.isInteger(amount)) {
    throw new Error('MONEY_NOT_INTEGER');
  }
  if (Math.abs(amount) > Number.MAX_SAFE_INTEGER) {
    throw new Error('MONEY_OVERFLOW');
  }
  return amount as MoneyCents;
}

/** Suma segura de importes (cierra a entero). */
export function addCents(a: MoneyCents, b: MoneyCents): MoneyCents {
  return moneyCents(a + b);
}

/**
 * Parsea una entrada decimal del usuario a centavos.
 * Acepta "18.500,50" (es) y "18,500.50" (en) de forma ambigua resolviendo
 * por el ÚLTIMO separador como decimal si tiene 1–2 dígitos tras él.
 * Regla MVP: sin separador de miles automático — el usuario escribe punto o coma decimal.
 */
export function parseAmountToCents(input: string): MoneyCents | null {
  const cleaned = input.trim().replace(/\s/g, '');
  if (cleaned === '' || cleaned === ',' || cleaned === '.') return null;
  const normalized = cleaned.replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return moneyCents(Math.round(value * 100));
}
