import { Board } from "../../domain/entities/Board";
import { Position } from "../../domain/entities/Position";
import type { PieceType, Player } from "../../domain/constants/PieceConstants";
import { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { canPlaceFromBench, getBenchPlacementSquares } from "../rules/turnRules";
import { countsOf, feasibleTypes } from "../../domain/rules/composition";
import { generateRandomArmy, type GeneratedArmy } from "../../domain/rules/randomArmy";
import type { BotContext, BotPlayAction, ComputerPlayer, DecisionInfo } from "./ComputerPlayer";
import type { Rng } from "./rng";

export type { Rng } from "./rng";
export type { BotPlayAction } from "./ComputerPlayer";

export interface EasyBotConfig {
  randomMoveChance: number;
  topK: number;
  weights: {
    score: number;
    capture: number;
    advancePerRow: number;
    threatened: number;
    noise: number;
  };
}

export const EASY_BOT_CONFIG: EasyBotConfig = {
  randomMoveChance: 0.3,
  topK: 3,
  weights: { score: 100, capture: 30, advancePerRow: 3, threatened: -15, noise: 5 },
};

/**
 * Bot "fácil": 1-ply con ponderación y azar. Puro — sin React ni Zustand.
 * No conoce ninguna regla propia: todo sale de `ctx.rules` y `ctx.engine`,
 * así sigue jugando legal si cambian tamaño, filas o movimientos.
 */

const pickIndex = <T>(arr: readonly T[], rng: Rng): T | undefined =>
  arr[Math.floor(rng() * arr.length)];

/**
 * Casillas amenazadas por el rival del bot: unión de lo que cada pieza rival
 * capturaría según el motor (`getCaptureSquares`), así respeta bloqueos
 * laterales y cualquier cambio de patrones de captura. Claves "x,y".
 */
export function getThreatenedSquares(
  board: Board,
  bot: Player,
  engine: MovementRuleEngine,
): Set<string> {
  const threatened = new Set<string>();
  for (const piece of board.getAllPieces()) {
    if (piece.owner === bot || !piece.position) continue;
    for (const square of engine.getCaptureSquares(piece, board)) {
      threatened.add(`${square.x},${square.y}`);
    }
  }
  return threatened;
}

interface MoveCandidate {
  pieceId: string;
  to: Position;
  score: number;
}

/**
 * Decide la próxima acción del bot en PLAYING: banca si puede (acción libre),
 * si no un movimiento ponderado — anotar > capturar > avanzar, con penalidad
 * por casillas amenazadas y ruido — y con probabilidad `randomMoveChance`
 * cualquier candidato. Sin movimientos ni banca → `pass`.
 */
export function choosePlayAction(
  ctx: BotContext,
  config: EasyBotConfig = EASY_BOT_CONFIG,
): BotPlayAction {
  return choosePlayActionScored(ctx, config).action;
}

/**
 * Igual que `choosePlayAction` pero además devuelve el diagnóstico de la
 * decisión (top de candidatas puntuadas, eval de la elegida, n = candidatas).
 */
export function choosePlayActionScored(
  ctx: BotContext,
  config: EasyBotConfig = EASY_BOT_CONFIG,
): { action: BotPlayAction; info: DecisionInfo } {
  const { board, bot, botState, engine, rules, rng } = ctx;

  if (canPlaceFromBench(board, bot, botState, rules)) {
    const squares = getBenchPlacementSquares(board, bot, rules);
    const benchPiece = botState.getBenchPieces()[0];
    if (squares.length > 0 && benchPiece) {
      // Preferencia por la fila de despliegue más adelantada.
      const home = rules.homeRow(bot);
      const bestRow = squares.reduce(
        (best, p) => (Math.abs(p.y - home) > Math.abs(best - home) ? p.y : best),
        squares[0]!.y,
      );
      const candidates = squares.filter((p) => p.y === bestRow);
      const to = pickIndex(candidates, rng);
      if (to) {
        return {
          action: { kind: "bench", benchPieceId: benchPiece.id, to },
          info: { nodes: 0, top: [] },
        };
      }
    }
  }

  const threatened = getThreatenedSquares(board, bot, engine);
  const scoringRow = rules.scoringRow(bot);
  const dir = rules.forward(bot);
  const candidates: MoveCandidate[] = [];

  for (const piece of board.getAllPieces()) {
    if (piece.owner !== bot || !piece.position) continue;
    const from = piece.position;
    for (const to of engine.getValidMoves(piece, board)) {
      let score = (to.y - from.y) * dir * config.weights.advancePerRow;
      if (to.y === scoringRow) score += config.weights.score;
      const target = board.getPieceAt(to);
      if (target && target.owner !== bot) score += config.weights.capture;
      if (threatened.has(`${to.x},${to.y}`)) score += config.weights.threatened;
      score += rng() * config.weights.noise;
      candidates.push({ pieceId: piece.id, to, score });
    }
  }

  const toAction = (c: MoveCandidate): BotPlayAction => ({
    kind: "move",
    pieceId: c.pieceId,
    to: c.to,
  });
  const infoOf = (pick: MoveCandidate | undefined): DecisionInfo => ({
    eval: pick?.score,
    nodes: candidates.length,
    top: [...candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((c) => ({ action: toAction(c), score: c.score })),
  });

  if (candidates.length === 0) return { action: { kind: "pass" }, info: infoOf(undefined) };

  if (rng() < config.randomMoveChance) {
    const pick = pickIndex(candidates, rng);
    return { action: pick ? toAction(pick) : { kind: "pass" }, info: infoOf(pick) };
  }

  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const pick = pickIndex(ranked.slice(0, config.topK), rng);
  return { action: pick ? toAction(pick) : { kind: "pass" }, info: infoOf(pick) };
}

/** Tipos ya elegidos por el bot (tablero + banca) y los que aún puede tomar. */
function allowedTypes(ctx: BotContext): PieceType[] {
  const chosen = ctx.botState
    .getSelectedPieces()
    .concat(ctx.botState.getBenchPieces().map((p) => p.type));
  const remaining = ctx.rules.piecesToPlace + ctx.rules.benchSize - chosen.length;
  return feasibleTypes(countsOf(chosen, ctx.rules), remaining, ctx.rules);
}

/**
 * Bot Easy con estado propio: al primer uso genera un ejército plan
 * (`generateRandomArmy`) y lo sigue mientras las casillas y la composición lo
 * permitan; si el plan se agota o no aplica, elige cualquier casilla/tipo
 * válido. Las decisiones usan `ctx.rng`; el plan usa el rng de la fábrica.
 */
export function createEasyBot(rng: Rng): ComputerPlayer {
  let plan: GeneratedArmy | null = null;
  let lastInfo: DecisionInfo | null = null;
  const plannedArmy = (ctx: BotContext): GeneratedArmy => {
    plan ??= generateRandomArmy(ctx.rules, ctx.bot, rng);
    return plan;
  };

  return {
    difficulty: "easy",

    chooseSetupPlacement(ctx) {
      const army = plannedArmy(ctx);
      const allowed = allowedTypes(ctx);
      const squares = getBenchPlacementSquares(ctx.board, ctx.bot, ctx.rules);
      // Primera pieza del plan cuya casilla siga libre y cuyo tipo sea legal.
      for (const { type, position } of army.boardPieces) {
        if (allowed.includes(type) && squares.some((s) => s.equals(position))) {
          return { type, position };
        }
      }
      const type = pickIndex(allowed, ctx.rng);
      const position = pickIndex(squares, ctx.rng);
      if (type === undefined || position === undefined) return null;
      return { type, position };
    },

    chooseBenchType(ctx) {
      const army = plannedArmy(ctx);
      const allowed = allowedTypes(ctx);
      if (allowed.length === 0) return null;
      // Siguiente tipo del plan de banca todavía no elegido (multiset).
      const pending = [...army.benchPieces];
      for (const piece of ctx.botState.getBenchPieces()) {
        const i = pending.indexOf(piece.type);
        if (i >= 0) pending.splice(i, 1);
      }
      const planned = pending.find((t) => allowed.includes(t));
      return planned ?? pickIndex(allowed, ctx.rng) ?? null;
    },

    choosePlayAction(ctx) {
      const { action, info } = choosePlayActionScored(ctx);
      lastInfo = info;
      return action;
    },

    getLastDecisionInfo() {
      return lastInfo;
    },
  };
}
