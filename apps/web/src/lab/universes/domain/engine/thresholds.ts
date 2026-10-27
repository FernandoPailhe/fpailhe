import type { GameSession, ID, ParameterThreshold } from "../models";
import { ENGINE_CONFIG } from "./config";
import { applyEffects, tryAbsorbWithShield, type EffectOpts, type EffectRun } from "./effects";
import type { EngineContext, GameContent } from "./types";

function thresholdMet(threshold: ParameterThreshold, value: number): boolean {
  return threshold.comparator === "lte" ? value <= threshold.value : value >= threshold.value;
}

/** Regla 5: valor seguro tras absorber un threshold con un shield. */
function safeValue(
  threshold: ParameterThreshold,
  min: number,
  max: number,
): number {
  const recovery = Math.round(ENGINE_CONFIG.SHIELD_RECOVERY_RATIO * (max - min));
  return threshold.comparator === "lte"
    ? Math.min(max, threshold.value + recovery)
    : Math.max(min, threshold.value - recovery);
}

/**
 * Evalúa los thresholds de los parámetros activos tras un cambio de estado.
 * Reglas 3, 5 y 6 del plan: thresholds por nivel (no por flanco), shields que
 * reposicionan el parámetro, cascada con tope MAX_CASCADE_DEPTH.
 */
export function settleThresholds(
  content: GameContent,
  session: GameSession,
  ec: EngineContext,
  opts: EffectOpts = {},
): EffectRun {
  let next = structuredClone(session);
  const events: EffectRun["events"] = [];
  const firedThisCall = new Set<ID>();
  const optionTags = opts.threatTags ?? [];

  for (let round = 0; round < ENGINE_CONFIG.MAX_CASCADE_DEPTH; round++) {
    if (next.status !== "active") break;
    let progress = false;

    for (const param of content.parameters) {
      if (next.status !== "active") break;
      if (!next.activeParameterIds.includes(param.id)) continue;

      for (const threshold of param.thresholds) {
        if (next.status !== "active") break;
        if (firedThisCall.has(threshold.id)) continue;
        if (threshold.once && next.firedThresholdIds.includes(threshold.id)) continue;
        const value = next.parameters[param.id] ?? param.initialValue;
        if (!thresholdMet(threshold, value)) continue;

        const tags = [...new Set([...(threshold.threatTags ?? []), ...optionTags])];
        const absorbedBy = tryAbsorbWithShield(content, next, tags, {
          ec,
          opts,
          events,
        });
        if (absorbedBy) {
          events.push({ type: "shield_used", powerId: absorbedBy, parameterId: param.id });
          next.parameters[param.id] = safeValue(threshold, param.min, param.max);
          progress = true;
          continue;
        }

        firedThisCall.add(threshold.id);
        events.push({ type: "threshold_fired", parameterId: param.id, thresholdId: threshold.id });
        if (threshold.once) next.firedThresholdIds.push(threshold.id);

        const run = applyEffects(content, next, threshold.effects, ec, {
          threatTags: tags,
        });
        next = run.session;
        events.push(...run.events);
        progress = true;
      }
    }

    if (!progress || next.status !== "active") break;
    if (round === ENGINE_CONFIG.MAX_CASCADE_DEPTH - 1) {
      events.push({ type: "cascade_limit_reached" });
      break;
    }
  }

  next.updatedAt = ec.now();
  return { session: next, events };
}
