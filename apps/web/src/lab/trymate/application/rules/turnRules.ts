import { Board } from "../../domain/entities/Board";
import { Position } from "../../domain/entities/Position";
import { PlayerState } from "../../domain/entities/PlayerState";
import { Player } from "../../domain/constants/PieceConstants";
import { GAME_RULES } from "../../domain/constants/GameRules";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { MovementRuleEngine } from "./MovementRuleEngine";

/**
 * Consultas puras de turno, sin gating de "jugador local": el store las usa
 * para validar al jugador en turno y el bot para evaluar al rival.
 */

export function getPlacementRows(player: Player): readonly number[] {
  return player === Player.BLANCAS
    ? GAME_RULES.PLACEMENT_ROWS_PLAYER1
    : GAME_RULES.PLACEMENT_ROWS_PLAYER2;
}

export function getScoringRow(player: Player): number {
  return player === Player.BLANCAS
    ? GAME_RULES.SCORING_ZONE_PLAYER1
    : GAME_RULES.SCORING_ZONE_PLAYER2;
}

/** Casillas vacías de las filas de despliegue con < MAX_PIECES_PER_ROW propias. */
export function getBenchPlacementSquares(board: Board, player: Player): Position[] {
  const positions: Position[] = [];
  for (const row of getPlacementRows(player)) {
    const piecesInRow = board
      .getAllPieces()
      .filter((p) => p.position && p.position.y === row && p.owner === player).length;
    if (piecesInRow >= GAME_RULES.MAX_PIECES_PER_ROW) continue;
    for (let col = 0; col < GAME_CONFIG.BOARD_WIDTH; col++) {
      const pos = new Position(col, row);
      if (!board.getPieceAt(pos)) {
        positions.push(pos);
      }
    }
  }
  return positions;
}

/** < PIECES_TO_PLACE piezas propias en tablero y banca no vacía. Sin chequeo de turno. */
export function canPlaceFromBench(board: Board, player: Player, playerState: PlayerState): boolean {
  const piecesOnBoard = board.getAllPieces().filter((p) => p.owner === player).length;
  return piecesOnBoard < GAME_RULES.PIECES_TO_PLACE && playerState.getBenchPieces().length > 0;
}

export function hasAnyLegalMove(board: Board, player: Player, engine: MovementRuleEngine): boolean {
  return board
    .getAllPieces()
    .some((p) => p.owner === player && engine.getValidMoves(p, board).length > 0);
}

export function hasAnyLegalAction(
  board: Board,
  player: Player,
  playerState: PlayerState,
  engine: MovementRuleEngine,
): boolean {
  if (hasAnyLegalMove(board, player, engine)) return true;
  // La banca solo cuenta como acción si además queda una casilla de despliegue
  // válida: banca llena de piezas pero filas tapadas sigue siendo un turno muerto.
  return (
    canPlaceFromBench(board, player, playerState) &&
    getBenchPlacementSquares(board, player).length > 0
  );
}
