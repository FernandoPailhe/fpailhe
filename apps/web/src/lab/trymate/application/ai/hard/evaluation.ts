import type { Player } from "../../../domain/constants/PieceConstants";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import type { RulesInsight } from "../introspection/profiles";
import { MEDIUM_BOT_CONFIG, type Posture } from "../medium/config";
import { explainEvaluationSides } from "../medium/evaluation";
import { analyzeBoard } from "../analysis/boardAnalysis";
import { choosePosture, weightsFor, type PostureOverrides } from "../medium/posture";
import { opponentOf } from "../sim/SimState";
import { raceScoreSides } from "./race";
import { seeBySide } from "./see";
import type { SearchBoard } from "./SearchBoard";
import { HARD_TERMS, type HardTerm } from "./weights";

/** Multiplicadores por bando para cada término (personalidades). */
export interface SideMultipliers {
  selfMul: Partial<Record<HardTerm, number>>;
  oppMul: Partial<Record<HardTerm, number>>;
}

export const NEUTRAL_SIDES: SideMultipliers = { selfMul: {}, oppMul: {} };

export type HardBreakdown = Record<HardTerm, number> & { total: number };

const hasAnyAction = (sb: SearchBoard, player: Player): boolean => {
  if (
    sb.board
      .getPiecesOf(player)
      .some((p) => p.position && sb.engine.getValidMoves(p, sb.board).length > 0)
  ) {
    return true;
  }
  return (
    sb.bench[player].length > 0 &&
    sb.piecesOnBoard[player] < sb.rules.piecesToPlace &&
    getBenchPlacementSquares(sb.board, player, sb.rules).length > 0
  );
};

/** Postura fija ("BALANCED" en tests) u overrides para decidirla por posición. */
export type PostureSpec = Posture | PostureOverrides;

/**
 * Evaluación Hard desde la perspectiva de `bot`. Por término:
 * `w[t] × postureMul[t] × (selfMul[t] × F_bot[t] − oppMul[t] × F_rival[t])`.
 * `containment`/`runnerThreat`/`see`/`race` ya vienen orientados (self = lo
 * que ejerce el bot). Bloqueo mutuo sin ganador → `contempt`.
 *
 * La postura se decide POR POSICIÓN evaluada (a diferencia de Medium, que la
 * fija en la raíz de una búsqueda de 2 plies): a 8+ plies la situación de la
 * hoja puede ser completamente distinta a la del root.
 */
export function explainHard(
  sb: SearchBoard,
  bot: Player,
  insight: RulesInsight,
  w: Record<HardTerm, number>,
  posture: PostureSpec,
  sides: SideMultipliers = NEUTRAL_SIDES,
  contempt = 0,
): HardBreakdown {
  const terms = {} as Record<HardTerm, number>;
  for (const t of HARD_TERMS) terms[t] = 0;
  const breakdown: HardBreakdown = { ...terms, total: 0 };

  if (sb.winner) {
    breakdown.total = (sb.winner === bot ? 1 : -1) * MEDIUM_BOT_CONFIG.winValue;
    return breakdown;
  }
  const opp = opponentOf(bot);
  if (!hasAnyAction(sb, bot) && !hasAnyAction(sb, opp)) {
    breakdown.total = contempt;
    return breakdown;
  }

  const state = sb.toSimState();
  const A = analyzeBoard(state.board, sb.engine, insight);
  const postureMul: Partial<Record<HardTerm, number>> =
    typeof posture === "string"
      ? weightsFor(posture)
      : weightsFor(choosePosture(state, bot, sb.engine, insight, A, posture));
  const side = explainEvaluationSides(state, bot, sb.engine, insight, A);
  const see = seeBySide(sb.board, bot, sb.engine, insight);
  const race = raceScoreSides(sb, bot, insight);

  const F: Record<HardTerm, { self: number; opp: number }> = {
    points: side.points,
    material: side.material,
    progress: side.progress,
    hanging: side.hanging,
    cohesion: side.cohesion,
    containment: side.containment,
    runnerThreat: side.runnerThreat,
    freeLane: side.freeLane,
    mobility: side.mobility,
    see,
    race,
  };

  for (const t of HARD_TERMS) {
    const contribution = (sides.selfMul[t] ?? 1) * F[t].self - (sides.oppMul[t] ?? 1) * F[t].opp;
    breakdown[t] = contribution;
    breakdown.total += w[t] * (postureMul[t] ?? 1) * contribution;
  }
  return breakdown;
}

export function evaluateHard(
  sb: SearchBoard,
  bot: Player,
  insight: RulesInsight,
  w: Record<HardTerm, number>,
  posture: PostureSpec,
  sides: SideMultipliers = NEUTRAL_SIDES,
  contempt = 0,
): number {
  return explainHard(sb, bot, insight, w, posture, sides, contempt).total;
}
