import { NEUTRAL_WEIGHTS, type EvalTerm } from "../medium/config";
import data from "./weights.json";

export type HardTerm = EvalTerm | "see" | "race";

export const HARD_TERMS: readonly HardTerm[] = [
  "points",
  "material",
  "progress",
  "hanging",
  "cohesion",
  "containment",
  "runnerThreat",
  "freeLane",
  "mobility",
  "see",
  "race",
];

export const DEFAULT_HARD_WEIGHTS: Record<HardTerm, number> = {
  ...NEUTRAL_WEIGHTS,
  see: 1,
  race: 1,
};

/**
 * Pesos ajustados por auto-juego, ligados al `rulesFingerprint` con el que se
 * corrió el tuning. Si las reglas cambiaron (o nunca se ajustó) se devuelven
 * igual los pesos ajustados con `stale: true` — los términos son agnósticos
 * de reglas y transferir la calibración rinde mejor que los neutros; el
 * facade avisa en dev para que se re-corra el tuning.
 */
export function loadHardWeights(currentFingerprint: string): {
  weights: Record<HardTerm, number>;
  stale: boolean;
} {
  const stale = data.fingerprint === null || data.fingerprint !== currentFingerprint;
  const weights = { ...DEFAULT_HARD_WEIGHTS };
  for (const term of HARD_TERMS) {
    const v = (data.terms as Record<string, number | undefined>)[term];
    if (typeof v === "number" && Number.isFinite(v)) weights[term] = v;
  }
  return { weights, stale };
}
