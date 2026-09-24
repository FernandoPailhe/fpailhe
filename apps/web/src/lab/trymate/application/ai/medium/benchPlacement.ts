import type { Position } from "../../../domain/entities/Position";
import type { PieceType, Player } from "../../../domain/constants/PieceConstants";
import type { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import type { RulesInsight } from "../introspection/profiles";
import type { Rng } from "../rng";
import { applySimBench, type SimState } from "../sim/SimState";
import { MEDIUM_BOT_CONFIG, type TermWeights } from "./config";
import { evaluate } from "./evaluation";

export interface BenchChoice {
  type: PieceType;
  to: Position;
  score: number;
}

/**
 * Decide qué pieza de la banca bajar y dónde. Es acción libre (no consume el
 * turno): si se puede bajar, siempre se baja — la decisión es cuál y dónde.
 * Prueba cada tipo distinto de la banca contra cada casilla de despliegue
 * válida y evalúa el estado resultante; empates dentro de `tieTolerance` se
 * deshacen con `rng`.
 *
 * Devuelve `null` si la banca está vacía, el tablero ya tiene
 * `piecesToPlace` propias o no hay casillas válidas.
 */
export function chooseBenchPlacement(
  state: SimState,
  bot: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
  weights: TermWeights,
  rng: Rng,
  tieTolerance: number = MEDIUM_BOT_CONFIG.bench.tieTolerance,
): BenchChoice | null {
  const bench = state.bench[bot];
  if (bench.length === 0) return null;

  const onBoard = state.board.getAllPieces().filter((p) => p.owner === bot).length;
  if (onBoard >= state.rules.piecesToPlace) return null;

  const squares = getBenchPlacementSquares(state.board, bot, state.rules);
  if (squares.length === 0) return null;

  const candidates: BenchChoice[] = [];
  for (const type of new Set(bench)) {
    for (const to of squares) {
      const next = applySimBench(state, type, to, `sim-bench-${type}`);
      candidates.push({ type, to, score: evaluate(next, bot, engine, insight, weights) });
    }
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!.score;
  const pool = candidates.filter((c) => c.score >= best - tieTolerance);
  return pool[Math.floor(rng() * pool.length)] ?? candidates[0]!;
}
