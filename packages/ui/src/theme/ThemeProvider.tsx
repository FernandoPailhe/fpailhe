import { useEffect } from "react";
import type { ReactNode } from "react";
import { themeTokens, type ThemeTokens } from "./tokens";
import { buildCssVariables } from "./cssVariables";

export interface ThemeProviderProps {
  /** Tokens a aplicar. Por defecto, `themeTokens` (el theme de la app). */
  tokens?: ThemeTokens;
  children: ReactNode;
}

/**
 * Vuelca `tokens` como variables CSS en `document.documentElement`.
 *
 * No envuelve a los hijos en ningún nodo extra (no hace falta: las
 * variables quedan en `:root`, visibles para toda la app). Pasar un
 * `tokens` distinto — incluso en runtime — recolorea el sitio entero
 * sin tocar un solo componente.
 */
export function ThemeProvider({ tokens = themeTokens, children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    const vars = buildCssVariables(tokens);
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
  }, [tokens]);

  return <>{children}</>;
}
