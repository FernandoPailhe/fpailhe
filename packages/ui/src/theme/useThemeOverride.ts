import { useEffect } from "react";
import { useTheme } from "./themeContext";
import type { ResolvedTheme } from "./themeContext";

/**
 * Fuerza un tema resuelto mientras el componente que lo invoca está
 * montado (ej. una sección que debe verse siempre en dark). Al desmontar
 * se restaura el tema elegido por el usuario. No persiste nada en
 * localStorage; sin `ThemeProvider` es noop.
 */
export function useThemeOverride(theme: ResolvedTheme): void {
  const { setThemeOverride } = useTheme();
  useEffect(() => {
    setThemeOverride(theme);
    return () => setThemeOverride(null);
  }, [theme, setThemeOverride]);
}
