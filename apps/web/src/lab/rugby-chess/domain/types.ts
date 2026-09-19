/**
 * Tipos de dominio del módulo rugby-chess.
 * Son internos del módulo: si alguno se vuelve reutilizable,
 * promoverlo a `packages/data-model/src/types.ts`.
 */

export type TeamSide = "home" | "away";

export type PieceKind = "forward" | "back" | "captain";

export interface Piece {
  id: string;
  kind: PieceKind;
  side: TeamSide;
}

export interface Square {
  row: number;
  col: number;
}

export interface BoardState {
  /** Cantidad de filas del tablero. */
  rows: number;
  /** Cantidad de columnas del tablero. */
  cols: number;
  /** Piezas vivas indexadas por id, con su posición. */
  pieces: Record<string, { piece: Piece; position: Square }>;
  /** Lado al que le toca mover. */
  turn: TeamSide;
}
