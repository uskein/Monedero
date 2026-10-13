/**
 * Tema móvil (HU-17) — Clay Serenity claro/oscuro con opción «Sistema».
 * SSOT: csColors / csColorsDark de @monedero/tokens (misma forma de claves →
 * los screens solo cambian la fuente de colores). ThemeProvider resuelve la
 * preferencia (light/dark/system) contra Appearance y re-renderiza.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { csColors, csColorsDark } from '@monedero/tokens';
import { usePrefsStore } from '../state/prefs.store';

export type ColorScheme = 'light' | 'dark';

/** Paleta con la MISMA forma que csColors (los literales varían por tema). */
export type ThemeColors = { [K in keyof typeof csColors]: string };

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
}

const ThemeContext = createContext<ThemeContextValue>({ colors: csColors, scheme: 'light' });

function useSystemScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);
  return scheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = usePrefsStore((s) => s.theme);
  const systemScheme = useSystemScheme();
  const scheme: ColorScheme = preference === 'system' ? systemScheme : preference === 'dark' ? 'dark' : 'light';
  const value = useMemo<ThemeContextValue>(
    () => ({ colors: scheme === 'dark' ? csColorsDark : csColors, scheme }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Paleta activa (tema claro u oscuro). Los estilos se crean vía useMemo. */
export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

/** Esquema resuelto ('light' | 'dark') — p. ej. para StatusBar. */
export function useThemeScheme(): ColorScheme {
  return useContext(ThemeContext).scheme;
}
