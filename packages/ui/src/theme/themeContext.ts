import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  /**
   * Fuerza el tema resuelto mientras un consumidor lo necesite (ej. una
   * sección siempre oscura). `null` restaura el tema del usuario. No
   * persiste en localStorage.
   */
  setThemeOverride: (theme: ResolvedTheme | null) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  setThemeOverride: () => {},
});

/** Hook para leer/cambiar el tema activo desde cualquier componente. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
