import { GamePiece } from "../entities/GamePiece";
import { Position } from "../entities/Position";
import { Board } from "../entities/Board";

export interface MoveValidationContext {
  piece: GamePiece;
  from: Position;
  to: Position;
  board: Board;
  isCapture: boolean;
}

export interface IMovementRule {
  getValidMoves(piece: GamePiece, board: Board): Position[];
  /** Casillas que `piece` capturaría si hubiera una pieza rival ahí. */
  getCaptureSquares(piece: GamePiece, board: Board): Position[];
  isValidMove(context: MoveValidationContext): boolean;
  canPassThrough(piece: GamePiece, position: Position, board: Board): boolean;
}
