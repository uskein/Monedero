/**
 * MoneyCents — tipo branded para dinero en centavos enteros (ADR: sin flotantes).
 * Fuente: MODELO_DE_DATOS.md (amount_cents INTEGER) · HU-18 (COP 0 dec / USD·EUR 2 dec).
 * TDD estricto (ESTRATEGIA_PRUEBAS §5): dinero es área crítica.
 * El parseo string→centavos vive en @monedero/i18n (regla única PWA/móvil, HU-18).
 */
import { parseAmountToCents as parseShared } from '@monedero/i18n';

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
 * Parsea una entrada decimal del usuario a MoneyCents.
 * Delega en la regla única de @monedero/i18n (HU-18): el ÚLTIMO separador es
 * decimal si tiene 1–2 dígitos tras él, si no es de miles. Devuelve null si no
 * es parseable. Se envuelve en MoneyCents para conservar el tipo branded.
 */
export function parseAmountToCents(input: string): MoneyCents | null {
  const cents = parseShared(input);
  return cents === null ? null : moneyCents(cents);
}
