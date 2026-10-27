import type { NarrativePhase } from "../application/types";

export type UniversePageKind = "home" | "play" | "end";

/**
 * Regla de redirección entre las páginas del universo según la fase:
 * `play` + `no_session` ⇒ home; `play` + `ended` ⇒ `/final`;
 * `end` + `no_session` ⇒ home; `end` + `card`/`between` ⇒ `/jugar`.
 */
export function redirectFor(
  slug: string,
  page: UniversePageKind,
  phase: NarrativePhase,
): string | null {
  const base = `/lab/universes/${slug}`;
  if (page === "play") {
    if (phase === "no_session") return base;
    if (phase === "ended") return `${base}/final`;
  }
  if (page === "end") {
    if (phase === "no_session") return base;
    if (phase === "card" || phase === "between") return `${base}/jugar`;
  }
  return null;
}
