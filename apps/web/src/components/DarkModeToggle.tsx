import { Button, useTheme } from "@ferpa/ui";
import type { ThemeMode } from "@ferpa/ui";

const NEXT: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Toggle de tema: cicla light → dark → system. La preferencia queda
 * persistida en localStorage vía ThemeProvider.
 */
export function DarkModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost-gold"
      aria-label={`Theme: ${LABELS[theme]} (currently ${resolvedTheme}). Activate to switch.`}
      onClick={() => setTheme(NEXT[theme])}
    >
      {LABELS[theme]}
    </Button>
  );
}
