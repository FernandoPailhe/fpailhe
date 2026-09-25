import type { Player } from "../../../domain/constants/PieceConstants";
import type { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { analyzeBoard, type BoardAnalysis } from "../analysis/boardAnalysis";
import type { RulesInsight } from "../introspection/profiles";
import { opponentOf, type SimState } from "../sim/SimState";
import { materialOf } from "./evaluation";
import {
  NEUTRAL_WEIGHTS,
  POSTURE_RULES,
  POSTURE_WEIGHTS,
  type Posture,
  type TermWeights,
} from "./config";

/** Pesos efectivos de una postura: neutrales con los multiplicadores encima. */
export function weightsFor(posture: Posture): TermWeights {
  return { ...NEUTRAL_WEIGHTS, ...POSTURE_WEIGHTS[posture] };
}

/**
 * Postura del turno (se decide una vez en la raíz, no por hoja):
 * 1. DEFEND si un rival está a `runnerZone` de anotar sin avance controlado,
 *    o le falta un solo punto para ganar.
 * 2. ATTACK si el bot tiene un corredor con carril libre cerca de la meta,
 *    ventaja material clara, o va ganando sin corredores rivales.
 * 3. BALANCED en el resto.
 */
export interface PostureOverrides {
  defendZone?: number;
  attackZone?: number;
  attackMaterialLeadRatio?: number;
}

export function choosePosture(
  state: SimState,
  bot: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
  analysis?: BoardAnalysis,
  overrides: PostureOverrides = {},
): Posture {
  const opp = opponentOf(bot);
  const G = insight.geometry;
  const defendZone = overrides.defendZone ?? G.runnerZone;
  const attackZone = overrides.attackZone ?? G.runnerZone + 1;
  const leadRatio = overrides.attackMaterialLeadRatio ?? POSTURE_RULES.attackMaterialLeadRatio;
  const A = analysis ?? analyzeBoard(state.board, engine, insight);
  const pieces = state.board.getAllPieces();
  const oppPieces = pieces.filter((p) => p.owner === opp && p.position);
  const botPieces = pieces.filter((p) => p.owner === bot && p.position);

  const runnerLoose = oppPieces.some(
    (p) => insight.distToGoal(p) <= defendZone && !A.isAdvanceControlled(p, bot),
  );
  if (runnerLoose || state.scores[opp] === state.rules.pointsToWin - 1) {
    return "DEFEND";
  }

  const ownRunner = botPieces.some((p) => A.hasFreeLane(p) && insight.distToGoal(p) <= attackZone);
  const meanValue =
    [...insight.profiles.values()].reduce((sum, p) => sum + p.value, 0) /
    Math.max(1, insight.profiles.size);
  const materialLead =
    materialOf(state, bot, insight) - materialOf(state, opp, insight) >= leadRatio * meanValue;
  const ahead =
    state.scores[bot] > state.scores[opp] &&
    !oppPieces.some((p) => insight.distToGoal(p) <= attackZone);
  if (ownRunner || materialLead || ahead) {
    return "ATTACK";
  }
  return "BALANCED";
}
