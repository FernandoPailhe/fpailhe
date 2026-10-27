import { describe, expect, it } from "vitest";
import { redirectFor } from "./universesRouting";
import type { NarrativePhase } from "../application/types";

const SLUG = "demo";
const BASE = `/lab/universes/${SLUG}`;

describe("redirectFor", () => {
  const phases: NarrativePhase[] = [
    "loading",
    "error",
    "no_session",
    "between",
    "card",
    "outcome",
    "ended",
  ];

  it("play: no_session → home, ended → /final, resto → null", () => {
    const expected: Record<NarrativePhase, string | null> = {
      loading: null,
      error: null,
      no_session: BASE,
      between: null,
      card: null,
      outcome: null,
      ended: `${BASE}/final`,
    };
    for (const p of phases) expect(redirectFor(SLUG, "play", p)).toBe(expected[p]);
  });

  it("end: no_session → home, card/between → /jugar, resto → null", () => {
    const expected: Record<NarrativePhase, string | null> = {
      loading: null,
      error: null,
      no_session: BASE,
      between: `${BASE}/jugar`,
      card: `${BASE}/jugar`,
      outcome: null,
      ended: null,
    };
    for (const p of phases) expect(redirectFor(SLUG, "end", p)).toBe(expected[p]);
  });

  it("home nunca redirige", () => {
    for (const p of phases) expect(redirectFor(SLUG, "home", p)).toBeNull();
  });
});
