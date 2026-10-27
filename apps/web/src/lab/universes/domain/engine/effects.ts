import type { Effect, GameSession, ID } from "../models";
import type { EngineContext, GameContent, GameEvent } from "./types";

export interface EffectRun {
  session: GameSession;
  events: GameEvent[];
}

export interface EffectOpts {
  /** Tags de amenaza de la opción elegida (regla 4 del plan). */
  threatTags?: readonly string[];
}

type Ctx = { ec: EngineContext; opts: EffectOpts; events: GameEvent[] };

/** Regla 7: aplica los powers `modifier` sobre un delta de `modify_parameter`. */
function applyModifiers(content: GameContent, session: GameSession, parameterId: ID, delta: number): number {
  let factor = 1;
  for (const owned of session.powers) {
    const power = content.powers.find((p) => p.id === owned.powerId);
    if (!power || power.kind !== "modifier") continue;
    if (power.parameterId !== undefined && power.parameterId !== parameterId) continue;
    const sign: "positive" | "negative" = delta >= 0 ? "positive" : "negative";
    if (power.appliesTo !== "both" && power.appliesTo !== sign) continue;
    factor *= power.multiplier;
  }
  return Math.round(delta * factor);
}

/**
 * Regla 5: si algún `shield` poseído con `charges >= 1` bloquea alguno de los
 * tags, consume 1 carga (el de menos cargas; desempate: orden en `powers`).
 * Devuelve el powerId usado o undefined.
 */
export function tryAbsorbWithShield(
  content: GameContent,
  session: GameSession,
  tags: readonly string[],
  ctx: { ec: EngineContext; opts: EffectOpts; events: GameEvent[] },
): ID | undefined {
  if (tags.length === 0) return undefined;
  const tagSet = new Set(tags);
  let best: { powerId: ID; charges: number } | undefined;
  for (const owned of session.powers) {
    if (owned.charges < 1) continue;
    const power = content.powers.find((p) => p.id === owned.powerId);
    if (!power || power.kind !== "shield") continue;
    if (!power.blocksThreatTags.some((t) => tagSet.has(t))) continue;
    if (!best || owned.charges < best.charges) {
      best = { powerId: owned.powerId, charges: owned.charges };
    }
  }
  if (!best) return undefined;
  applyOne(content, session, { type: "consume_power", powerId: best.powerId, charges: 1 }, ctx);
  return best.powerId;
}

function mergeTags(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

function applyOne(content: GameContent, session: GameSession, effect: Effect, ctx: Ctx): void {
  const { ec, opts, events } = ctx;
  switch (effect.type) {
    case "modify_parameter": {
      const param = content.parameters.find((p) => p.id === effect.parameterId);
      if (!param) return;
      const current = session.parameters[effect.parameterId] ?? param.initialValue;
      const delta = applyModifiers(content, session, effect.parameterId, effect.delta);
      const next = Math.min(param.max, Math.max(param.min, current + delta));
      if (next !== current) {
        session.parameters[effect.parameterId] = next;
        events.push({ type: "parameter_changed", parameterId: effect.parameterId, from: current, to: next, delta: next - current });
      }
      return;
    }
    case "set_parameter": {
      const param = content.parameters.find((p) => p.id === effect.parameterId);
      if (!param) return;
      const current = session.parameters[effect.parameterId] ?? param.initialValue;
      const next = Math.min(param.max, Math.max(param.min, effect.value));
      if (next !== current) {
        session.parameters[effect.parameterId] = next;
        events.push({ type: "parameter_changed", parameterId: effect.parameterId, from: current, to: next, delta: next - current });
      }
      return;
    }
    case "activate_parameter": {
      if (!session.activeParameterIds.includes(effect.parameterId)) {
        session.activeParameterIds.push(effect.parameterId);
        events.push({ type: "parameter_activated", parameterId: effect.parameterId });
      }
      return;
    }
    case "deactivate_parameter": {
      const idx = session.activeParameterIds.indexOf(effect.parameterId);
      if (idx >= 0) {
        session.activeParameterIds.splice(idx, 1);
        events.push({ type: "parameter_deactivated", parameterId: effect.parameterId });
      }
      return;
    }
    case "add_score": {
      if (effect.points !== 0) {
        const from = session.score;
        session.score += effect.points;
        events.push({ type: "score_changed", from, to: session.score });
      }
      return;
    }
    case "set_flag": {
      session.flags[effect.flag] = effect.value;
      return;
    }
    case "enter_branch": {
      const branch = content.branches.find((b) => b.id === effect.branchId);
      if (branch?.exclusiveGroup) {
        const leaving = session.branchIds.filter((id) => {
          if (id === effect.branchId) return false;
          const other = content.branches.find((b) => b.id === id);
          return other?.exclusiveGroup === branch.exclusiveGroup;
        });
        for (const id of leaving) {
          session.branchIds = session.branchIds.filter((b) => b !== id);
          events.push({ type: "branch_left", branchId: id });
        }
      }
      if (!session.branchIds.includes(effect.branchId)) {
        session.branchIds.push(effect.branchId);
        events.push({ type: "branch_entered", branchId: effect.branchId });
      }
      return;
    }
    case "leave_branch": {
      if (session.branchIds.includes(effect.branchId)) {
        session.branchIds = session.branchIds.filter((b) => b !== effect.branchId);
        events.push({ type: "branch_left", branchId: effect.branchId });
      }
      return;
    }
    case "unlock_character": {
      if (!session.unlockedCharacterIds.includes(effect.characterId)) {
        session.unlockedCharacterIds.push(effect.characterId);
        events.push({ type: "character_unlocked", characterId: effect.characterId });
      }
      return;
    }
    case "lock_character": {
      if (session.unlockedCharacterIds.includes(effect.characterId)) {
        session.unlockedCharacterIds = session.unlockedCharacterIds.filter(
          (c) => c !== effect.characterId,
        );
        events.push({ type: "character_locked", characterId: effect.characterId });
      }
      return;
    }
    case "grant_power": {
      const power = content.powers.find((p) => p.id === effect.powerId);
      const add = effect.charges ?? 1;
      const owned = session.powers.find((p) => p.powerId === effect.powerId);
      const cap = power?.maxCharges;
      const next = Math.min(cap ?? Number.MAX_SAFE_INTEGER, (owned?.charges ?? 0) + add);
      if (owned) owned.charges = next;
      else session.powers.push({ powerId: effect.powerId, charges: next });
      events.push({ type: "power_granted", powerId: effect.powerId, charges: next });
      return;
    }
    case "consume_power": {
      const owned = session.powers.find((p) => p.powerId === effect.powerId);
      if (!owned) return;
      owned.charges = Math.max(0, owned.charges - (effect.charges ?? 1));
      if (owned.charges === 0) {
        session.powers = session.powers.filter((p) => p.powerId !== effect.powerId);
      }
      events.push({ type: "power_consumed", powerId: effect.powerId, charges: owned.charges });
      return;
    }
    case "award_badge": {
      if (!session.earnedBadgeIds.includes(effect.badgeId)) {
        session.earnedBadgeIds.push(effect.badgeId);
        events.push({ type: "badge_awarded", badgeId: effect.badgeId });
      }
      return;
    }
    case "enqueue_card": {
      const dueTurn = session.turn + (effect.delayTurns ?? 1);
      session.cardQueue.push({ cardId: effect.cardId, dueTurn });
      events.push({ type: "card_enqueued", cardId: effect.cardId, dueTurn });
      return;
    }
    case "end_game": {
      const tags = mergeTags(effect.threatTags, opts.threatTags);
      const absorbedBy = tryAbsorbWithShield(content, session, tags, ctx);
      if (absorbedBy) {
        events.push({ type: "shield_used", powerId: absorbedBy });
        return;
      }
      session.status = effect.outcome === "victory" ? "won" : "lost";
      session.endingKey = effect.endingKey;
      session.endedAt = ec.now();
      events.push({ type: "game_ended", outcome: effect.outcome, endingKey: effect.endingKey });
      return;
    }
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

/**
 * Aplica una lista de efectos sobre una copia de la sesión (regla 13: pura).
 * `end_game` corta el resto de la lista (regla 2).
 */
export function applyEffects(
  content: GameContent,
  session: GameSession,
  effects: readonly Effect[],
  ec: EngineContext,
  opts: EffectOpts = {},
): EffectRun {
  const next = structuredClone(session);
  const events: GameEvent[] = [];
  const ctx: Ctx = { ec, opts, events };
  for (const effect of effects) {
    if (next.status !== "active") break;
    applyOne(content, next, effect, ctx);
  }
  next.updatedAt = ec.now();
  return { session: next, events };
}
