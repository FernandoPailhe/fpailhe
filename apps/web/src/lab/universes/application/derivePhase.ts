import type { GameSession } from "../domain/models";
import type { LastResolution } from "./store/sessionStore";
import type { NarrativePhase } from "./types";

export interface PhaseInput {
  contentStatus: "loading" | "error" | "success";
  hydrated: boolean;
  session: GameSession | null;
  lastResolution: LastResolution | null;
  hasCurrentCard: boolean;
}

/** Deriva la fase de la UI a partir del estado cargado/hidratado/sesión. */
export function derivePhase(input: PhaseInput): NarrativePhase {
  if (input.contentStatus === "error") return "error";
  if (input.contentStatus !== "success" || !input.hydrated) return "loading";
  if (!input.session) return "no_session";
  if (input.lastResolution) return "outcome";
  if (input.session.status !== "active") return "ended";
  if (input.hasCurrentCard) return "card";
  return "between";
}
