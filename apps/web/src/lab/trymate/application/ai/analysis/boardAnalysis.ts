import type { Board } from "../../../domain/entities/Board";
import type { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import type { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import type { RulesInsight } from "../introspection/profiles";

const key = (x: number, y: number): string => `${x},${y}`;

/**
 * Lectura del tablero solo con el motor + `RulesInsight`: ataques, defensas,
 * avances, tapones, carriles y aislamiento. Nada depende de tipos concretos.
 * `attacks[band]` = casilla → piezas de `band` que la capturarían (sigue el
 * patrón de recaptura del juego).
 */
export interface BoardAnalysis {
  attacks: Record<Player, Map<string, GamePiece[]>>;
  /** pieceId → getValidMoves (una sola llamada por pieza). */
  legalMoves: Map<string, Position[]>;
  /** `by` capturaría en `square` si hubiera una pieza rival ahí. */
  isAttacked(square: Position, by: Player): boolean;
  /** Otra pieza propia podría recapturar sobre la casilla de `piece`. */
  isDefended(piece: GamePiece): boolean;
  /** Jugadas legales a casilla vacía que aumentan el progreso. */
  advanceMoves(piece: GamePiece): Position[];
  /**
   * Todas las casillas de avance de `piece` están atacadas por `controller`
   * u ocupadas por una pieza suya — o no le queda ninguna.
   */
  isAdvanceControlled(piece: GamePiece, controller: Player): boolean;
  /** Sin avances y con una pieza de `by` a Chebyshev 1 por delante. */
  isPlugged(piece: GamePiece, by: Player): boolean;
  /** Ningún rival por delante dentro de `laneWindow` columnas. */
  hasFreeLane(piece: GamePiece): boolean;
  /** Ninguna propia a Chebyshev ≤ `supportRadius`. */
  isIsolated(piece: GamePiece): boolean;
  legalMoveCount(player: Player): number;
}

export function analyzeBoard(
  board: Board,
  engine: MovementRuleEngine,
  insight: RulesInsight,
): BoardAnalysis {
  const { rules, geometry } = insight;
  const pieces = board.getAllPieces().filter((p) => p.position !== null);

  const attacks: Record<Player, Map<string, GamePiece[]>> = {
    [Player.BLANCAS]: new Map(),
    [Player.NEGRAS]: new Map(),
  };
  const legalMoves = new Map<string, Position[]>();
  const bySquare = new Map<string, GamePiece>();

  for (const piece of pieces) {
    bySquare.set(key(piece.position!.x, piece.position!.y), piece);
    legalMoves.set(piece.id, engine.getValidMoves(piece, board));
    for (const square of engine.getCaptureSquares(piece, board)) {
      const k = key(square.x, square.y);
      const list = attacks[piece.owner].get(k);
      if (list) {
        list.push(piece);
      } else {
        attacks[piece.owner].set(k, [piece]);
      }
    }
  }

  const isAttacked = (square: Position, by: Player): boolean =>
    (attacks[by].get(key(square.x, square.y))?.length ?? 0) > 0;

  const isDefended = (piece: GamePiece): boolean => {
    if (!piece.position) return false;
    const defenders = attacks[piece.owner].get(key(piece.position.x, piece.position.y));
    return defenders?.some((p) => p.id !== piece.id) ?? false;
  };

  const forwardGain = (piece: GamePiece, to: Position): number =>
    (to.y - piece.position!.y) * rules.forward(piece.owner);

  const advanceMoves = (piece: GamePiece): Position[] => {
    if (!piece.position) return [];
    return (legalMoves.get(piece.id) ?? []).filter(
      (to) => forwardGain(piece, to) > 0 && !bySquare.has(key(to.x, to.y)),
    );
  };

  /** Casillas legales que aumentan progreso, ocupadas o no. */
  const progressTargets = (piece: GamePiece): Position[] => {
    if (!piece.position) return [];
    return (legalMoves.get(piece.id) ?? []).filter((to) => forwardGain(piece, to) > 0);
  };

  const isAdvanceControlled = (piece: GamePiece, controller: Player): boolean => {
    const targets = progressTargets(piece);
    if (targets.length === 0) return true;
    return targets.every(
      (to) =>
        (attacks[controller].get(key(to.x, to.y))?.length ?? 0) > 0 ||
        bySquare.get(key(to.x, to.y))?.owner === controller,
    );
  };

  const isPlugged = (piece: GamePiece, by: Player): boolean => {
    if (!piece.position || advanceMoves(piece).length > 0) return false;
    const forward = rules.forward(piece.owner);
    for (let dx = -1; dx <= 1; dx++) {
      const occupant = bySquare.get(key(piece.position.x + dx, piece.position.y + forward));
      if (occupant && occupant.owner === by) return true;
    }
    return false;
  };

  const hasFreeLane = (piece: GamePiece): boolean => {
    if (!piece.position) return false;
    const forward = rules.forward(piece.owner);
    for (const other of pieces) {
      if (other.owner === piece.owner || !other.position) continue;
      const ahead = (other.position.y - piece.position.y) * forward > 0;
      if (ahead && Math.abs(other.position.x - piece.position.x) <= geometry.laneWindow) {
        return false;
      }
    }
    return true;
  };

  const isIsolated = (piece: GamePiece): boolean => {
    if (!piece.position) return false;
    for (const other of pieces) {
      if (other.id === piece.id || other.owner !== piece.owner || !other.position) continue;
      const chebyshev = Math.max(
        Math.abs(other.position.x - piece.position.x),
        Math.abs(other.position.y - piece.position.y),
      );
      if (chebyshev <= geometry.supportRadius) return false;
    }
    return true;
  };

  const legalMoveCount = (player: Player): number =>
    pieces.reduce(
      (count, p) => (p.owner === player ? count + (legalMoves.get(p.id)?.length ?? 0) : count),
      0,
    );

  return {
    attacks,
    legalMoves,
    isAttacked,
    isDefended,
    advanceMoves,
    isAdvanceControlled,
    isPlugged,
    hasFreeLane,
    isIsolated,
    legalMoveCount,
  };
}
