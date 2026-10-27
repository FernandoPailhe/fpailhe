import type { Parameter } from "../models";
import { ENGINE_CONFIG } from "./config";

/**
 * Riesgo de un parámetro: "low" si está cerca de un threshold `lte`,
 * "high" si está cerca de un `gte`. Si se cumplen ambos, gana el más cercano.
 * Solo considera thresholds cuyo extremo está dentro de [min, max].
 */
export function getThresholdRisk(
  parameter: Parameter,
  value: number,
  ratio: number = ENGINE_CONFIG.THRESHOLD_RISK_RATIO,
): "low" | "high" | null {
  const range = parameter.max - parameter.min;
  if (range <= 0) return null;
  const margin = ratio * range;

  let lowDistance = Infinity;
  let highDistance = Infinity;
  for (const t of parameter.thresholds) {
    if (t.value < parameter.min || t.value > parameter.max) continue;
    if (t.comparator === "lte" && value <= t.value + margin) {
      lowDistance = Math.min(lowDistance, value - t.value);
    }
    if (t.comparator === "gte" && value >= t.value - margin) {
      highDistance = Math.min(highDistance, t.value - value);
    }
  }

  if (lowDistance === Infinity && highDistance === Infinity) return null;
  return lowDistance <= highDistance ? "low" : "high";
}
