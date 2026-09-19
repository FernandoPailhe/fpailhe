import type { BoardState, Piece, Square } from "./types";

/**
 * Lógica pura del juego (reglas, movimientos, estado del tablero).
 * Sin React, sin fetch: funciones puras testeables con vitest.
 */

export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;

function makePiece(id: string, side: Piece["side"], kind: Piece["kind"]): Piece {
  return { id, side, kind };
}

/** Crea el estado inicial del tablero. Placeholder hasta definir las reglas reales. */
export function createInitialBoard(): BoardState {
  const pieces: BoardState["pieces"] = {};

  for (let col = 0; col < BOARD_COLS; col += 1) {
    const homePiece = makePiece(`home-${col}`, "home", "forward");
    const awayPiece = makePiece(`away-${col}`, "away", "forward");
    pieces[homePiece.id] = { piece: homePiece, position: { row: BOARD_ROWS - 1, col } };
    pieces[awayPiece.id] = { piece: awayPiece, position: { row: 0, col } };
  }

  return {
    rows: BOARD_ROWS,
    cols: BOARD_COLS,
    pieces,
    turn: "home",
  };
}

/** Devuelve la pieza en una casilla, o `undefined` si está vacía. */
export function getPieceAt(board: BoardState, square: Square): Piece | undefined {
  for (const entry of Object.values(board.pieces)) {
    if (entry.position.row === square.row && entry.position.col === square.col) {
      return entry.piece;
    }
  }
  return undefined;
}
