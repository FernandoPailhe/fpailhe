import type { Board } from "../../../domain/entities/Board";
import type { Player } from "../../../domain/constants/PieceConstants";
import type { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import type { RulesInsight } from "../introspection/profiles";
import type { Rng } from "../rng";
import {
  applySimMove,
  generateMoves,
  passTurn,
  type SimMove,
  type SimState,
} from "../sim/SimState";
import { MEDIUM_BOT_CONFIG, type TermWeights } from "./config";
import { evaluate } from "./evaluation";

export interface SearchResult {
  move: SimMove | null;
  score: number;
  /** Profundidad de la última iteración completada. */
  depth: number;
  nodes: number;
  /** Todas las jugadas raíz puntuadas, mejor primero. */
  ranked: { move: SimMove; score: number }[];
}

export interface SearchConfig {
  depth: number;
  endgameDepth: number;
  nodeBudget: number;
  tolerance: number;
  blunderChance: number;
}

/**
 * Orden para alfa-beta: anotar > capturar (por valor de la víctima) > mayor
 * aumento de progreso. Orden estable sobre el array recibido.
 */
export function orderMoves(moves: SimMove[], board: Board, insight: RulesInsight): SimMove[] {
  const captureValue = (m: SimMove): number =>
    m.capture === undefined ? 0 : (insight.profiles.get(m.capture)?.value ?? 0);
  const progressGain = (m: SimMove): number => {
    const piece = board.getPieceById(m.pieceId);
    if (!piece?.position) return 0;
    const before = Math.abs(piece.position.y - insight.rules.homeRow(piece.owner));
    return Math.abs(m.to.y - insight.rules.homeRow(piece.owner)) - before;
  };
  return [...moves].sort((a, b) => {
    if (a.scores !== b.scores) return a.scores ? -1 : 1;
    const byCapture = captureValue(b) - captureValue(a);
    if (byCapture !== 0) return byCapture;
    return progressGain(b) - progressGain(a);
  });
}

interface SearchCtx {
  bot: Player;
  engine: MovementRuleEngine;
  insight: RulesInsight;
  weights: TermWeights;
  nodeBudget: number;
  nodes: number;
  aborted: boolean;
}

const leafValue = (state: SimState, ctx: SearchCtx): number =>
  evaluate(state, ctx.bot, ctx.engine, ctx.insight, ctx.weights) *
  (state.current === ctx.bot ? 1 : -1);

/**
 * Negamax alfa-beta. Devuelve el valor desde la perspectiva del jugador en
 * turno. Sin jugadas → el turno pasa (consume una ply); bloqueo mutuo → hoja.
 */
function negamax(
  state: SimState,
  depthLeft: number,
  alpha: number,
  beta: number,
  ctx: SearchCtx,
): number {
  if (++ctx.nodes > ctx.nodeBudget) {
    ctx.aborted = true;
    return 0;
  }
  if (state.winner) {
    // Ganar antes vale más; perder después cuesta menos.
    return (state.winner === state.current ? 1 : -1) * (MEDIUM_BOT_CONFIG.winValue + depthLeft);
  }
  if (depthLeft <= 0) return leafValue(state, ctx);

  const moves = orderMoves(generateMoves(state, ctx.engine), state.board, ctx.insight);
  if (moves.length === 0) {
    const passed = passTurn(state);
    if (generateMoves(passed, ctx.engine).length === 0) {
      return leafValue(state, ctx); // bloqueo mutuo: fin de la partida
    }
    return -negamax(passed, depthLeft - 1, -beta, -alpha, ctx);
  }

  let best = -Infinity;
  for (const move of moves) {
    const score = -negamax(applySimMove(state, move), depthLeft - 1, -beta, -alpha, ctx);
    if (ctx.aborted) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Búsqueda con iterative deepening hasta `cfg.depth` (`cfg.endgameDepth` si
 * quedan ≤ endgamePieces piezas). La raíz evalúa cada jugada con ventana
 * completa para armar `ranked`. Si se agota `nodeBudget` a mitad de una
 * iteración se usa la última completa. Elección: mejor jugada, con algo de
 * variedad (`tolerance`) y una pizca de "segunda mejor" (`blunderChance`).
 */
export function searchBestMove(
  root: SimState,
  bot: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
  weights: TermWeights,
  rng: Rng,
  cfg: SearchConfig = MEDIUM_BOT_CONFIG.search,
): SearchResult {
  const ctx: SearchCtx = {
    bot,
    engine,
    insight,
    weights,
    nodeBudget: cfg.nodeBudget,
    nodes: 0,
    aborted: false,
  };

  const rootMoves = orderMoves(generateMoves(root, engine), root.board, insight);
  if (rootMoves.length === 0) {
    return {
      move: null,
      score: evaluate(root, bot, engine, insight, weights),
      depth: 0,
      nodes: ctx.nodes,
      ranked: [],
    };
  }

  const piecesOnBoard = root.board.getAllPieces().length;
  const target = piecesOnBoard <= insight.geometry.endgamePieces ? cfg.endgameDepth : cfg.depth;

  let ranked: { move: SimMove; score: number }[] = [];
  let completedDepth = 0;
  let ordered = rootMoves;

  for (let depth = 1; depth <= target; depth++) {
    const iteration: { move: SimMove; score: number }[] = [];
    let aborted = false;
    for (const move of ordered) {
      const score = -negamax(applySimMove(root, move), depth - 1, -Infinity, Infinity, ctx);
      if (ctx.aborted) {
        aborted = true;
        break;
      }
      iteration.push({ move, score });
    }
    if (aborted || iteration.length === 0) break;
    iteration.sort((a, b) => b.score - a.score);
    ranked = iteration;
    completedDepth = depth;
    ordered = iteration.map((r) => r.move); // mejor orden la próxima pasada
  }

  if (ranked.length === 0) {
    // Presupuesto agotado en la primera pasada: fallback 1-ply acotado.
    ranked = rootMoves.map((move) => ({
      move,
      score: evaluate(applySimMove(root, move), bot, engine, insight, weights),
    }));
    ranked.sort((a, b) => b.score - a.score);
  }

  const best = ranked[0]!;
  let pick = best;
  const winning = best.score >= MEDIUM_BOT_CONFIG.winValue / 2;
  if (!winning) {
    if (ranked.length >= 2 && rng() < cfg.blunderChance) {
      pick = ranked[1]!;
    } else {
      const pool = ranked.filter((r) => r.score >= best.score - cfg.tolerance);
      pick = pool[Math.floor(rng() * pool.length)] ?? best;
    }
  }

  return { move: pick.move, score: pick.score, depth: completedDepth, nodes: ctx.nodes, ranked };
}
