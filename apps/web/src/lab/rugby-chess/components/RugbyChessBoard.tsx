import type { BoardState } from "../domain/types";
import { getPieceAt } from "../domain/engine";

export interface RugbyChessBoardProps {
  board: BoardState;
}

/**
 * Render del tablero. Componente específico del módulo:
 * si surge un "Board"/"Grid" genérico reutilizable, va en `packages/ui`.
 */
export function RugbyChessBoard({ board }: RugbyChessBoardProps) {
  const squares = [];
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const piece = getPieceAt(board, { row, col });
      const isDark = (row + col) % 2 === 1;
      squares.push(
        <div
          key={`${row}-${col}`}
          className={`flex aspect-square items-center justify-center border border-line font-ui text-xs ${
            isDark ? "bg-surface-alt" : "bg-surface"
          }`}
        >
          {piece ? piece.side === "home" ? "H" : "A" : null}
        </div>,
      );
    }
  }

  return (
    <div
      role="grid"
      aria-label="Rugby chess board"
      className="grid w-full max-w-[480px] gap-0"
      style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
    >
      {squares}
    </div>
  );
}
