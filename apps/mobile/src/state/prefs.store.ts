/**
 * Prefs store (móvil) — ajustes de apariencia y moneda (HU-17 · HU-18).
 * Persistidos en SecureStore (clave por clave; preferencias no sensibles pero
 * el contenedor ya existe y es el único almacenamiento nativo disponible en
 * Expo Go — el repo definitivo llegará con el dev-build). Import DINÁMICO:
 * en jest nunca se carga expo-secure-store.
 */
import { create } from 'zustand';
import type { CurrencyCode } from '@monedero/i18n';

export type ThemePreference = 'light' | 'dark' | 'system';

const KEYS = {
  theme: 'monedero.prefs.theme',
  currency: 'monedero.prefs.currency',
} as const;

const THEMES: ThemePreference[] = ['light', 'dark', 'system'];
const CURRENCIES: CurrencyCode[] = ['COP', 'USD', 'EUR'];

interface PrefsState {
  theme: ThemePreference;
  currency: CurrencyCode;
  /** true tras intentar la carga inicial (los controles se habilitan entonces). */
  ready: boolean;
  init: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
}

export const usePrefsStore = create<PrefsState>((set) => ({
  theme: 'light',
  currency: 'COP',
  ready: false,

  init: async () => {
    try {
      const ss = await import('expo-secure-store');
      const [theme, currency] = await Promise.all([
        ss.getItemAsync(KEYS.theme),
        ss.getItemAsync(KEYS.currency),
      ]);
      set({
        theme: THEMES.includes(theme as ThemePreference) ? (theme as ThemePreference) : 'light',
        currency: CURRENCIES.includes(currency as CurrencyCode) ? (currency as CurrencyCode) : 'COP',
        ready: true,
      });
    } catch {
      set({ ready: true }); // sin storage → defaults
    }
  },

  setTheme: async (theme) => {
    set({ theme });
    try {
      const ss = await import('expo-secure-store');
      await ss.setItemAsync(KEYS.theme, theme);
    } catch {
      // preferencia en memoria al menos durante la sesión
    }
  },

  setCurrency: async (currency) => {
    set({ currency });
    try {
      const ss = await import('expo-secure-store');
      await ss.setItemAsync(KEYS.currency, currency);
    } catch {
      // idem
    }
  },
}));
