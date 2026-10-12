/**
 * Binding React del i18n — Provider + useT().
 * Ambas apps consumen esto; cero strings hardcodeados en UI (gate lint i18n).
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createTranslator, detectLocale, type Locale, type TFunction, type TranslationKey } from './translator';
import { formatMoney, formatMoneySigned, symbolFor, decimalsFor, type CurrencyCode } from './format';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
  /** Formatea centavos con la moneda dada (módulo único HU-18). */
  money: (cents: number, currency: CurrencyCode) => string;
  moneySigned: (cents: number, currency: CurrencyCode, isIncome: boolean) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  /**
   * Locale inicial. Prioridad: prop explícita → localStorage (preferencia del usuario)
   * → detección del dispositivo. En tests jsdom reporta en-US: se fija es-CO en setup.
   */
  initialLocale?: Locale;
  /** Moneda por defecto de la bóveda (HU-18: formateo, no conversión) */
  defaultCurrency?: CurrencyCode;
}

const LOCALE_STORAGE_KEY = 'monedero.locale';

// Acceso defensivo a globals de navegador: en React Native no existen (ni localStorage
// ni navigator.languages). `globalThis[...]` evita ReferenceError y el try/catch del
// caller cubre el caso de almacenamiento bloqueado (modo privado).
function browserStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void } | null {
  const store = (
    globalThis as {
      localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
    }
  ).localStorage;
  return typeof store?.getItem === 'function' ? store : null;
}

function deviceLanguages(): readonly string[] | undefined {
  const nav = (globalThis as { navigator?: { languages?: readonly string[] } }).navigator;
  return nav?.languages;
}

function resolveInitialLocale(explicit?: Locale): Locale {
  if (explicit) return explicit;
  const store = browserStorage();
  if (store) {
    try {
      const saved = store.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'es-CO' || saved === 'en-US') return saved;
    } catch {
      /* almacenamiento no disponible — sigue con detección */
    }
  }
  return detectLocale(deviceLanguages());
}

export function I18nProvider({ children, initialLocale, defaultCurrency = 'COP' }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale(initialLocale));
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocale(next);
        const store = browserStorage();
        if (!store) return; // sin localStorage (RN): el locale vive en memoria
        try {
          store.setItem(LOCALE_STORAGE_KEY, next);
        } catch {
          /* almacenamiento no disponible (modo privado) — el locale vive en memoria */
        }
      },
      t: createTranslator(locale),
      money: (cents, cur) => formatMoney(cents, cur ?? currency, locale),
      moneySigned: (cents, cur, isIncome) => formatMoneySigned(cents, cur ?? currency, locale, isIncome),
    }),
    [locale, currency],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n fuera de I18nProvider');
  return ctx;
}

/** Atajo: solo la función t(). */
export function useT(): TFunction {
  return useI18n().t;
}

export type { TranslationKey };
export { symbolFor, decimalsFor };
