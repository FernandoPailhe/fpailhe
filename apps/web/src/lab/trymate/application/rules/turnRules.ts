import { Board } from "../../domain/entities/Board";
import { Position } from "../../domain/entities/Position";
import { PlayerState } from "../../domain/entities/PlayerState";
import { Player } from "../../domain/constants/PieceConstants";
import { CURRENT_RULES, type RulesView } from "../../domain/config/RulesView";
import { MovementRuleEngine } from "./MovementRuleEngine";

/**
 * Consultas puras de turno, sin gating de "jugador local": el store las usa
 * para validar al jugador en turno y el bot para evaluar al rival.
 * Todas aceptan un `rules` opcional (default: las reglas vigentes) para que
 * bots y simulaciones puedan jugar con variantes de reglas.
 */

export function getPlacementRows(
  player: Player,
  rules: RulesView = CURRENT_RULES,
): readonly number[] {
  return rules.placementRows(player);
}

export function getScoringRow(player: Player, rules: RulesView = CURRENT_RULES): number {
  return rules.scoringRow(player);
}

/** Casillas vacías de las filas de despliegue con < maxPerRow propias. */
export function getBenchPlacementSquares(
  board: Board,
  player: Player,
  rules: RulesView = CURRENT_RULES,
): Position[] {
  const positions: Position[] = [];
  for (const row of rules.placementRows(player)) {
    const piecesInRow = board
      .getAllPieces()
      .filter((p) => p.position && p.position.y === row && p.owner === player).length;
    if (piecesInRow >= rules.maxPerRow) continue;
    for (let col = 0; col < rules.width; col++) {
      const pos = new Position(col, row);
      if (!board.getPieceAt(pos)) {
        positions.push(pos);
      }
    }
  }
  return positions;
}

/** < piecesToPlace piezas propias en tablero y banca no vacía. Sin chequeo de turno. */
export function canPlaceFromBench(
  board: Board,
  player: Player,
  playerState: PlayerState,
  rules: RulesView = CURRENT_RULES,
): boolean {
  const piecesOnBoard = board.getAllPieces().filter((p) => p.owner === player).length;
  return piecesOnBoard < rules.piecesToPlace && playerState.getBenchPieces().length > 0;
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
  rules: RulesView = CURRENT_RULES,
): boolean {
  if (hasAnyLegalMove(board, player, engine)) return true;
  // La banca solo cuenta como acción si además queda una casilla de despliegue
  // válida: banca llena de piezas pero filas tapadas sigue siendo un turno muerto.
  return (
    canPlaceFromBench(board, player, playerState, rules) &&
    getBenchPlacementSquares(board, player, rules).length > 0
  );
}
