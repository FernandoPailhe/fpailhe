import type { GameSession } from "../models";
import { evaluateCondition } from "./conditions";
import { applyEffects, type EffectRun } from "./effects";
import { settleThresholds } from "./thresholds";
import type { EngineContext, GameContent } from "./types";

/**
 * Regla 11: si la siguiente etapa por `order` cumple `score >= minScore` y
 * `enterConditions`, avanza (máximo una por turno): setea `stageId`, activa
 * `activatesParameterIds`, corre `onEnter` y re-evalúa thresholds.
 */
export function advanceStageIfReady(
  content: GameContent,
  session: GameSession,
  ec: EngineContext,
): EffectRun {
  const current = content.stages.find((s) => s.id === session.stageId);
  const next = content.stages
    .filter((s) => current === undefined || s.order > current.order)
    .sort((a, b) => a.order - b.order)[0];

  if (!next || session.score < next.minScore) return { session, events: [] };
  if (!evaluateCondition(next.enterConditions, session, content)) return { session, events: [] };

  let result = structuredClone(session);
  result.stageId = next.id;
  const events: EffectRun["events"] = [{ type: "stage_advanced", stageId: next.id }];

  const entry = applyEffects(
    content,
    result,
    [
      ...(next.activatesParameterIds ?? []).map(
        (parameterId): Parameters<typeof applyEffects>[2][number] => ({
          type: "activate_parameter",
          parameterId,
        }),
      ),
      ...(next.onEnter ?? []),
    ],
    ec,
  );
  result = entry.session;
  events.push(...entry.events);

  if (result.status === "active") {
    const settled = settleThresholds(content, result, ec);
    result = settled.session;
    events.push(...settled.events);
  }
  return { session: result, events };
}

/**
 * Desbloqueo automático (regla 1d): cada personaje bloqueado cuya
 * `unlockCondition` se cumple pasa a `unlockedCharacterIds`.
 */
export function unlockCharactersByCondition(
  content: GameContent,
  session: GameSession,
  ec: EngineContext,
): EffectRun {
  const toUnlock = content.characters
    .filter(
      (c) => !session.unlockedCharacterIds.includes(c.id) && c.unlockCondition !== undefined,
    )
    .filter((c) => evaluateCondition(c.unlockCondition, session, content));
  if (toUnlock.length === 0) return { session, events: [] };
  return applyEffects(
    content,
    session,
    toUnlock.map((c) => ({ type: "unlock_character" as const, characterId: c.id })),
    ec,
  );
}
