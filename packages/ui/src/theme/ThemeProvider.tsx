import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { themeTokens, type ThemeTokens } from "./tokens";
import { darkTokens as defaultDarkTokens } from "./darkTokens";
import { buildCssVariables } from "./cssVariables";
import { ThemeContext } from "./themeContext";
import type { ResolvedTheme, ThemeContextValue, ThemeMode } from "./themeContext";

export interface ThemeProviderProps {
  /** Tokens del tema claro. Por defecto, `themeTokens` (el theme de la app). */
  tokens?: ThemeTokens;
  /** Tokens del tema oscuro. Por defecto, `darkTokens`. */
  darkTokens?: ThemeTokens;
  children: ReactNode;
}

const STORAGE_KEY = "theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function readStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * Vuelca los tokens como variables CSS en `document.documentElement`.
 *
 * No envuelve a los hijos en ningún nodo extra (no hace falta: las
 * variables quedan en `:root`, visibles para toda la app). Soporta
 * tema claro/oscuro/sistema: la preferencia se persiste en
 * `localStorage` y `system` sigue a `prefers-color-scheme` en vivo.
 */
export function ThemeProvider({
  tokens = themeTokens,
  darkTokens = defaultDarkTokens,
  children,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const [themeOverride, setThemeOverride] = useState<ResolvedTheme | null>(null);

  useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme =
    themeOverride ?? (theme === "system" ? systemTheme : theme);

  useEffect(() => {
    const root = document.documentElement;
    const active = resolvedTheme === "dark" ? darkTokens : tokens;
    const vars = buildCssVariables(active);
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
    root.dataset.theme = resolvedTheme;
  }, [resolvedTheme, tokens, darkTokens]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage no disponible (modo privado, etc.): el tema igual se aplica.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, setThemeOverride }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
