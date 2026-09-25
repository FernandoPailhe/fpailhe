import type { GamePiece } from "../../../domain/entities/GamePiece";
import type { Player } from "../../../domain/constants/PieceConstants";
import type { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { analyzeBoard, type BoardAnalysis } from "../analysis/boardAnalysis";
import type { RulesInsight } from "../introspection/profiles";
import { opponentOf, type SimState } from "../sim/SimState";
import { MEDIUM_BOT_CONFIG, NEUTRAL_WEIGHTS, type EvalTerm, type TermWeights } from "./config";

export type EvalBreakdown = Record<EvalTerm, number> & { total: number };

const cfg = MEDIUM_BOT_CONFIG;

/** Bonus por cercanía a la meta: `base / d^exponent` si d ≤ runnerZone (d ≥ 1). */
export function runnerBonus(d: number, insight: RulesInsight): number {
  if (d < 1 || d > insight.geometry.runnerZone) return 0;
  return cfg.runner.base / Math.pow(d, cfg.runner.exponent);
}

const profileValue = (piece: GamePiece, insight: RulesInsight): number =>
  insight.profiles.get(piece.type)?.value ?? 0;

/** Material de un bando: piezas en tablero + banca ponderada por `benchFactor`. */
export function materialOf(state: SimState, side: Player, insight: RulesInsight): number {
  let sum = 0;
  for (const piece of state.board.getAllPieces()) {
    if (piece.owner === side && piece.position) sum += profileValue(piece, insight);
  }
  for (const type of state.bench[side]) {
    sum += (insight.profiles.get(type)?.value ?? 0) * cfg.benchFactor;
  }
  return sum;
}

interface SideTerms {
  material: number;
  progress: number;
  hanging: number;
  cohesion: number;
  containment: number;
  freeLane: number;
  mobility: number;
}

function sideTerms(
  state: SimState,
  side: Player,
  A: BoardAnalysis,
  insight: RulesInsight,
): SideTerms {
  const enemy = opponentOf(side);
  const G = insight.geometry;
  const material = materialOf(state, side, insight);
  let progress = 0;
  let hanging = 0;
  let cohesion = 0;
  let freeLane = 0;

  const advanced: { piece: GamePiece; progress: number }[] = [];
  for (const piece of state.board.getAllPieces()) {
    if (piece.owner !== side || !piece.position) continue;
    const profile = insight.profiles.get(piece.type);
    const prog = insight.progress(piece);
    const d = insight.distToGoal(piece);

    progress += (profile?.forwardReach ?? 0) * prog + runnerBonus(d, insight);
    advanced.push({ piece, progress: prog });

    if (A.isAttacked(piece.position, enemy)) {
      const factor = A.isDefended(piece) ? cfg.hanging.defended : cfg.hanging.undefended;
      const tempo = side === state.current ? cfg.hanging.sideToMoveFactor : 1;
      hanging -= (profile?.value ?? 0) * factor * tempo;
    }

    if (prog >= G.runnerZone && A.isDefended(piece)) cohesion += cfg.cohesion.supported;
    if (A.isIsolated(piece) && !A.hasFreeLane(piece)) cohesion += cfg.cohesion.isolated;
    if (A.hasFreeLane(piece)) {
      freeLane += cfg.freeLane.perRow * (G.runnerZone + 2 - Math.min(d, G.runnerZone + 2));
    }
  }

  // Estiramiento: el líder se despega del segundo más allá de `stretchSlack`
  // y no tiene carril libre para justificarlo.
  if (advanced.length >= 2) {
    const sorted = [...advanced].sort((a, b) => b.progress - a.progress);
    const leader = sorted[0]!;
    const second = sorted[1]!;
    if (!A.hasFreeLane(leader.piece)) {
      cohesion +=
        cfg.cohesion.stretchPerRow *
        Math.max(0, leader.progress - second.progress - G.stretchSlack);
    }
  }

  // Contención que `side` ejerce sobre las piezas del rival.
  let containment = 0;
  for (const piece of state.board.getAllPieces()) {
    if (piece.owner !== enemy || !piece.position) continue;
    const advances = A.advanceMoves(piece);
    containment += cfg.containment.perAdvanceMove * advances.length;
    if (A.isPlugged(piece, side)) containment += cfg.containment.plugged;
    if (advances.length > 0 && A.isAdvanceControlled(piece, side)) {
      containment += cfg.containment.fullyControlled;
    }
  }

  return {
    material,
    progress,
    hanging,
    cohesion,
    containment,
    freeLane,
    mobility: cfg.mobility * A.legalMoveCount(side),
  };
}

/**
 * Evaluación con desglose: cada término es `F(bot) − F(rival)` salvo
 * `runnerThreat`, que solo lo paga el bot (su versión simétrica ya la cubre
 * `containment`). `total` aplica los pesos por postura.
 */
export function explainEvaluation(
  state: SimState,
  bot: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
  weights: TermWeights = NEUTRAL_WEIGHTS,
  analysis?: BoardAnalysis,
): EvalBreakdown {
  const zero = (): EvalBreakdown => ({
    points: 0,
    material: 0,
    progress: 0,
    hanging: 0,
    cohesion: 0,
    containment: 0,
    runnerThreat: 0,
    freeLane: 0,
    mobility: 0,
    total: 0,
  });

  if (state.winner) {
    const breakdown = zero();
    breakdown.total = (state.winner === bot ? 1 : -1) * cfg.winValue;
    return breakdown;
  }

  const opp = opponentOf(bot);
  const A = analysis ?? analyzeBoard(state.board, engine, insight);
  const G = insight.geometry;

  const own = sideTerms(state, bot, A, insight);
  const theirs = sideTerms(state, opp, A, insight);

  // Amenaza de corredor rival: solo resta al bot.
  let runnerThreat = 0;
  const floor = cfg.runner.base / Math.pow(G.runnerZone + 1, cfg.runner.exponent);
  for (const piece of state.board.getAllPieces()) {
    if (piece.owner !== opp || !piece.position) continue;
    const d = insight.distToGoal(piece);
    if (d <= G.runnerZone + 1 && !A.isAdvanceControlled(piece, bot)) {
      runnerThreat -= cfg.runner.threatFactor * Math.max(runnerBonus(d, insight), floor);
    }
  }

  const breakdown: EvalBreakdown = {
    points: (state.scores[bot] - state.scores[opp]) * cfg.pointValue,
    material: own.material - theirs.material,
    progress: own.progress - theirs.progress,
    hanging: own.hanging - theirs.hanging,
    cohesion: own.cohesion - theirs.cohesion,
    containment: own.containment - theirs.containment,
    runnerThreat,
    freeLane: own.freeLane - theirs.freeLane,
    mobility: own.mobility - theirs.mobility,
    total: 0,
  };
  for (const term of Object.keys(weights) as EvalTerm[]) {
    breakdown.total += weights[term] * breakdown[term];
  }
  return breakdown;
}

export type SideBreakdown = Record<EvalTerm, { self: number; opp: number }>;

/**
 * Los mismos cálculos que `explainEvaluation` pero sin restar: los términos
 * del bot (`self`) y del rival (`opp`) por separado. `containment` y
 * `runnerThreat` van en `self` (los aplica el bot sobre piezas rivales).
 * Sirve para ponderar por bando (personalidades).
 */
export function explainEvaluationSides(
  state: SimState,
  bot: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
  analysis?: BoardAnalysis,
): SideBreakdown {
  const opp = opponentOf(bot);
  const A = analysis ?? analyzeBoard(state.board, engine, insight);
  const G = insight.geometry;
  const own = sideTerms(state, bot, A, insight);
  const theirs = sideTerms(state, opp, A, insight);

  let runnerThreat = 0;
  const floor = cfg.runner.base / Math.pow(G.runnerZone + 1, cfg.runner.exponent);
  for (const piece of state.board.getAllPieces()) {
    if (piece.owner !== opp || !piece.position) continue;
    const d = insight.distToGoal(piece);
    if (d <= G.runnerZone + 1 && !A.isAdvanceControlled(piece, bot)) {
      runnerThreat -= cfg.runner.threatFactor * Math.max(runnerBonus(d, insight), floor);
    }
  }

  return {
    points: { self: state.scores[bot] * cfg.pointValue, opp: state.scores[opp] * cfg.pointValue },
    material: { self: own.material, opp: theirs.material },
    progress: { self: own.progress, opp: theirs.progress },
    hanging: { self: own.hanging, opp: theirs.hanging },
    cohesion: { self: own.cohesion, opp: theirs.cohesion },
    containment: { self: own.containment, opp: theirs.containment },
    runnerThreat: { self: runnerThreat, opp: 0 },
    freeLane: { self: own.freeLane, opp: theirs.freeLane },
    mobility: { self: own.mobility, opp: theirs.mobility },
  };
}

/** Evaluación escalar desde la perspectiva del bot. */
export function evaluate(
  state: SimState,
  bot: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
  weights: TermWeights = NEUTRAL_WEIGHTS,
  analysis?: BoardAnalysis,
): number {
  return explainEvaluation(state, bot, engine, insight, weights, analysis).total;
}
