import type { Comparator, Condition, GameSession } from "../models";
import type { GameContent } from "./types";

export function compare(a: number, comparator: Comparator, b: number): boolean {
  switch (comparator) {
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
    case "eq":
      return a === b;
    case "gte":
      return a >= b;
    case "gt":
      return a > b;
    case "neq":
      return a !== b;
  }
}

/**
 * Evalúa una `Condition` contra la sesión. `undefined` => true.
 * `content.stages` solo se usa para `stage_at_least` (mapear stageId → order).
 */
export function evaluateCondition(
  condition: Condition | undefined,
  session: GameSession,
  content: Pick<GameContent, "stages">,
): boolean {
  if (!condition) return true;
  switch (condition.type) {
    case "all":
      return condition.conditions.every((c) => evaluateCondition(c, session, content));
    case "any":
      return condition.conditions.some((c) => evaluateCondition(c, session, content));
    case "not":
      return !evaluateCondition(condition.condition, session, content);
    case "parameter": {
      const value = session.parameters[condition.parameterId];
      if (value === undefined) return false;
      return compare(value, condition.comparator, condition.value);
    }
    case "score":
      return compare(session.score, condition.comparator, condition.value);
    case "stage_at_least": {
      const order = content.stages.find((s) => s.id === session.stageId)?.order;
      return order !== undefined && order >= condition.stageOrder;
    }
    case "in_branch":
      return session.branchIds.includes(condition.branchId);
    case "has_flag": {
      if (!(condition.flag in session.flags)) return false;
      if (condition.value === undefined) return true;
      return session.flags[condition.flag] === condition.value;
    }
    case "has_power": {
      const owned = session.powers.find((p) => p.powerId === condition.powerId);
      return owned !== undefined && owned.charges >= (condition.minCharges ?? 1);
    }
    case "character_unlocked":
      return session.unlockedCharacterIds.includes(condition.characterId);
    case "card_seen": {
      const seen = session.cardHistory[condition.cardId];
      if (!seen || seen.count <= 0) return false;
      if (condition.optionId === undefined) return true;
      return seen.lastOptionId === condition.optionId;
    }
    case "turn":
      return compare(session.turn, condition.comparator, condition.value);
    default: {
      const _exhaustive: never = condition;
      return false;
    }
  }
}
