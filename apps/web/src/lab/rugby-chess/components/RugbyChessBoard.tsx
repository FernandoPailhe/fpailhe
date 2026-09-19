import { useGameStore } from "../application/GameState";
import { GAME_CONFIG } from "../domain/constants/GameConstants";
import { GamePhase } from "../domain/constants/GameRules";
import { Position } from "../domain/entities/Position";
import { BoardTile, type BoardTileState } from "./BoardTile";

/**
 * Tablero 5×11 conectado al store. Suscripción completa (decisión 2 del
 * plan: `board` muta in-place, hace falta re-render en cada `set()`).
 * Toda interacción de casillas entra por `handleTileClick`.
 */
export function RugbyChessBoard() {
  const {
    board,
    selectedPiece,
    validMoves,
    blockedMoves,
    isViewingHistory,
    gamePhase,
    handleTileClick,
  } = useGameStore();

  const inert =
    isViewingHistory ||
    gamePhase === GamePhase.BENCH_SELECTION ||
    gamePhase === GamePhase.GAME_OVER;

  const rows = [];
  for (let y = GAME_CONFIG.BOARD_HEIGHT - 1; y >= 0; y--) {
    const cells = [];
    for (let x = 0; x < GAME_CONFIG.BOARD_WIDTH; x++) {
      const position = new Position(x, y);
      const piece = board.getPieceAt(position);
      const tileState: BoardTileState = selectedPiece?.position?.equals(position)
        ? "selected"
        : validMoves.some((p) => p.equals(position))
          ? "valid"
          : blockedMoves.some((p) => p.equals(position))
            ? "blocked"
            : "idle";
      cells.push(
        <BoardTile
          key={`${x}-${y}`}
          position={position}
          piece={piece}
          state={tileState}
          disabled={inert}
          onSelect={() => handleTileClick(position)}
        />,
      );
    }
    rows.push(
      <div
        key={y}
        role="row"
        aria-rowindex={GAME_CONFIG.BOARD_HEIGHT - y}
        className="grid grid-cols-5"
      >
        {cells}
      </div>,
    );
  }

  return (
    <div
      role="grid"
      aria-label="Rugby chess board"
      aria-rowcount={GAME_CONFIG.BOARD_HEIGHT}
      aria-colcount={GAME_CONFIG.BOARD_WIDTH}
      aria-disabled={inert}
      className={`mx-auto w-full max-w-[420px] ${isViewingHistory ? "opacity-60" : ""}`}
    >
      {rows}
    </div>
  );
}
