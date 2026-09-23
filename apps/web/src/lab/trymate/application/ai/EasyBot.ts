import { Board } from "../../domain/entities/Board";
import { Position } from "../../domain/entities/Position";
import { PlayerState } from "../../domain/entities/PlayerState";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { QUICK_START_LAYOUTS, type QuickStartLayout } from "../../domain/config/QuickStartLayout";
import { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { canPlaceFromBench, getBenchPlacementSquares, getScoringRow } from "../rules/turnRules";

export type Rng = () => number;

export type BotPlayAction =
  | { kind: "bench"; benchPieceId: string; to: Position }
  | { kind: "move"; pieceId: string; to: Position }
  | { kind: "pass" };

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
 * Bot "fácil": 1-ply con ponderación y azar. Puro — sin React ni Zustand —
 * y con `rng` inyectable para tests deterministas. Nunca muta el tablero.
 */

const pickIndex = <T>(arr: readonly T[], rng: Rng): T | undefined =>
  arr[Math.floor(rng() * arr.length)];

/** Id de un layout de quick start al azar (el bot arma su ejército con él). */
export function pickBotLayoutId(rng: Rng): string {
  const layout = pickIndex(QUICK_START_LAYOUTS, rng);
  if (!layout) {
    throw new Error("EasyBot: no hay layouts de quick start configurados");
  }
  return layout.id;
}

/**
 * Siguiente pieza del `layout` aún no colocada: la primera cuya casilla está
 * libre. El layout ya viene espejado (`resolveQuickStartLayout(bot, id)`).
 */
export function nextSetupPlacement(
  board: Board,
  bot: Player,
  layout: QuickStartLayout,
): { type: PieceType; position: Position } | null {
  for (const { type, position } of layout.boardPieces) {
    const occupant = board.getPieceAt(position);
    if (occupant === undefined) return { type, position };
    // Defensivo: el setup rival nunca ocupa las filas del bot; si pasara,
    // salteamos la casilla en vez de proponer una colocación inválida.
    if (occupant.owner !== bot) continue;
  }
  return null;
}

/** Siguiente tipo de `layout.benchPieces` que la banca aún no completó. */
export function nextBenchType(
  playerState: PlayerState,
  layout: QuickStartLayout,
): PieceType | null {
  const remaining = new Map<PieceType, number>();
  for (const type of layout.benchPieces) {
    remaining.set(type, (remaining.get(type) ?? 0) + 1);
  }
  for (const piece of playerState.getBenchPieces()) {
    const left = remaining.get(piece.type);
    if (left !== undefined) remaining.set(piece.type, left - 1);
  }
  for (const type of layout.benchPieces) {
    if ((remaining.get(type) ?? 0) > 0) return type;
  }
  return null;
}

/**
 * Aproximación barata de casillas amenazadas por el rival del bot: las 2
 * diagonales hacia adelante de cada FORT rival y la casilla de enfrente de
 * cada STRIKER rival. No simula bloqueos. Claves "x,y".
 */
export function getThreatenedSquares(board: Board, bot: Player): Set<string> {
  const threatened = new Set<string>();
  for (const piece of board.getAllPieces()) {
    if (piece.owner === bot || !piece.position) continue;
    const dxs: readonly number[] =
      piece.type === PieceType.FORT ? [-1, 1] : piece.type === PieceType.STRIKER ? [0] : [];
    const dir = piece.getDirectionMultiplier();
    for (const dx of dxs) {
      const x = piece.position.x + dx;
      const y = piece.position.y + dir;
      // Position lanza con coordenadas negativas: chequear bordes antes.
      if (x < 0 || x >= GAME_CONFIG.BOARD_WIDTH || y < 0 || y >= GAME_CONFIG.BOARD_HEIGHT) {
        continue;
      }
      threatened.add(`${x},${y}`);
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
  board: Board,
  bot: Player,
  playerState: PlayerState,
  engine: MovementRuleEngine,
  rng: Rng,
  config: EasyBotConfig = EASY_BOT_CONFIG,
): BotPlayAction {
  if (canPlaceFromBench(board, bot, playerState)) {
    const squares = getBenchPlacementSquares(board, bot);
    const benchPiece = playerState.getBenchPieces()[0];
    if (squares.length > 0 && benchPiece) {
      // Preferencia por la fila de despliegue más adelantada.
      const bestRow =
        bot === Player.BLANCAS
          ? Math.max(...squares.map((p) => p.y))
          : Math.min(...squares.map((p) => p.y));
      const candidates = squares.filter((p) => p.y === bestRow);
      const to = pickIndex(candidates, rng);
      if (to) return { kind: "bench", benchPieceId: benchPiece.id, to };
    }
  }

  const threatened = getThreatenedSquares(board, bot);
  const scoringRow = getScoringRow(bot);
  const candidates: MoveCandidate[] = [];

  for (const piece of board.getAllPieces()) {
    if (piece.owner !== bot || !piece.position) continue;
    const from = piece.position;
    const dir = piece.getDirectionMultiplier();
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

  if (candidates.length === 0) return { kind: "pass" };

  if (rng() < config.randomMoveChance) {
    const pick = pickIndex(candidates, rng);
    return pick ? { kind: "move", pieceId: pick.pieceId, to: pick.to } : { kind: "pass" };
  }

  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const pick = pickIndex(ranked.slice(0, config.topK), rng);
  return pick ? { kind: "move", pieceId: pick.pieceId, to: pick.to } : { kind: "pass" };
}
