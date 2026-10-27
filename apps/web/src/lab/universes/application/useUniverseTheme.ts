import { useSessionStore } from "./store/sessionStore";
import { useNarrativeContent } from "./useNarrativeContent";
import { buildThemeInput } from "./viewModels";
import type { ThemeInput } from "./types";

/**
 * Entrada de tema para el layout: estética + overrides activos según la sesión
 * del store. Sin slug o sin contenido ⇒ `{ activeOverrides: [] }`.
 */
export function useUniverseTheme(slug?: string): { theme: ThemeInput; locale?: string } {
  const { content } = useNarrativeContent(slug ?? "", { enabled: !!slug });
  const session = useSessionStore((s) => (slug ? (s.slots[slug]?.session ?? null) : null));
  if (!content) return { theme: { activeOverrides: [] } };
  return { theme: buildThemeInput(content, session), locale: session?.locale };
}
