import { useRef, useState, type KeyboardEvent } from "react";
import { useGameStore } from "../application/GameState";
import { GAME_CONFIG } from "../domain/constants/GameConstants";
import { GameMode, GamePhase, SetupTurnMode } from "../domain/constants/GameRules";
import { Player } from "../domain/constants/PieceConstants";
import { Position } from "../domain/entities/Position";
import { useBoardSize } from "../lib/useBoardSize";
import { BoardTile, type BoardTileState } from "./BoardTile";

/**
 * Tablero 5×11 conectado al store. Suscripción completa (decisión 2 del
 * plan: `board` muta in-place, hace falta re-render en cada `set()`).
 * Toda interacción de casillas entra por `handleTileClick`.
 * Teclado: patrón ARIA grid — un solo tab stop (roving tabindex) y
 * flechas/Home/End para mover el foco; Enter/Space activa la casilla.
 */
export function TryMateBoard() {
  const {
    board,
    selectedPiece,
    validMoves,
    blockedMoves,
    isViewingHistory,
    moveHistory,
    gamePhase,
    gameMode,
    setupMode,
    currentPlayer,
    localPlayer,
    isLocalPlayerTurn,
    handleTileClick,
  } = useGameStore();

  const [focusedPos, setFocusedPos] = useState(() => new Position(0, 0));
  const gridRef = useRef<HTMLDivElement>(null);
  // El wrapper a ancho completo es el contenedor medido; el grid recibe un
  // ancho explícito derivado del alto de ventana (máx. 90vh de alto total).
  // Callback ref (no RefObject) para que el hook re-mida al montar el nodo.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const boardSize = useBoardSize(containerEl);

  // Setup oculto: durante la configuración solo se ven las piezas del
  // jugador que está configurando; las del rival quedan enmascaradas.
  const hiddenSetup = gamePhase === GamePhase.SETUP && setupMode === SetupTurnMode.HIDDEN;

  const notMyTurn = gameMode !== GameMode.PVP && !isLocalPlayerTurn();
  // Issue #20: en online cada jugador ve su equipo abajo — el guest (NEGRAS)
  // recibe el tablero rotado 180° (filas y columnas invertidas).
  const flipped = gameMode === GameMode.ONLINE && localPlayer === Player.NEGRAS;
  const inert = isViewingHistory || notMyTurn || gamePhase === GamePhase.GAME_OVER;

  // Jugada activa del historial: la última en el presente, o la seleccionada
  // al navegar hacia atrás/adelante. Sus casillas from/to se resaltan.
  const currentMove = moveHistory.getCurrentMove();

  const moveFocus = (next: Position) => {
    setFocusedPos(next);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-square="${next.x},${next.y}"]`)
      ?.focus();
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { x, y } = focusedPos;
    let next: Position;
    const up = flipped ? -1 : 1;
    const right = flipped ? -1 : 1;
    switch (event.key) {
      case "ArrowUp":
        next = new Position(x, Math.min(Math.max(y + up, 0), GAME_CONFIG.BOARD_HEIGHT - 1));
        break;
      case "ArrowDown":
        next = new Position(x, Math.min(Math.max(y - up, 0), GAME_CONFIG.BOARD_HEIGHT - 1));
        break;
      case "ArrowLeft":
        next = new Position(Math.min(Math.max(x - right, 0), GAME_CONFIG.BOARD_WIDTH - 1), y);
        break;
      case "ArrowRight":
        next = new Position(Math.min(Math.max(x + right, 0), GAME_CONFIG.BOARD_WIDTH - 1), y);
        break;
      case "Home":
        next = new Position(flipped ? GAME_CONFIG.BOARD_WIDTH - 1 : 0, y);
        break;
      case "End":
        next = new Position(flipped ? 0 : GAME_CONFIG.BOARD_WIDTH - 1, y);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(next);
  };

  const ys = flipped
    ? Array.from({ length: GAME_CONFIG.BOARD_HEIGHT }, (_, i) => i)
    : Array.from({ length: GAME_CONFIG.BOARD_HEIGHT }, (_, i) => GAME_CONFIG.BOARD_HEIGHT - 1 - i);
  const xs = flipped
    ? Array.from({ length: GAME_CONFIG.BOARD_WIDTH }, (_, i) => GAME_CONFIG.BOARD_WIDTH - 1 - i)
    : Array.from({ length: GAME_CONFIG.BOARD_WIDTH }, (_, i) => i);

  const rows = [];
  for (const y of ys) {
    const cells = [];
    for (const x of xs) {
      const position = new Position(x, y);
      const pieceOnTile = board.getPieceAt(position);
      const piece = hiddenSetup && pieceOnTile?.owner !== currentPlayer ? undefined : pieceOnTile;
      const tileState: BoardTileState = selectedPiece?.position?.equals(position)
        ? "selected"
        : validMoves.some((p) => p.equals(position))
          ? "valid"
          : blockedMoves.some((p) => p.equals(position))
            ? "blocked"
            : "idle";
      const isLastMove =
        !!currentMove && (currentMove.from.equals(position) || currentMove.to.equals(position));
      cells.push(
        <BoardTile
          key={`${x}-${y}`}
          position={position}
          piece={piece}
          state={tileState}
          isLastMove={isLastMove}
          disabled={inert}
          flipped={flipped}
          tabIndex={focusedPos.equals(position) ? 0 : -1}
          onSelect={() => handleTileClick(position)}
          onFocus={() => setFocusedPos(position)}
        />,
      );
    }
    rows.push(
      <div
        key={y}
        role="row"
        aria-rowindex={flipped ? y + 1 : GAME_CONFIG.BOARD_HEIGHT - y}
        className="grid grid-cols-5"
      >
        {cells}
      </div>,
    );
  }

  return (
    <div ref={setContainerEl} className="w-full">
      <div
        ref={gridRef}
        role="grid"
        aria-label="TryMate board"
        aria-rowcount={GAME_CONFIG.BOARD_HEIGHT}
        aria-colcount={GAME_CONFIG.BOARD_WIDTH}
        aria-disabled={inert}
        onKeyDown={onGridKeyDown}
        className={`ml-auto ${inert ? "opacity-60" : ""} mobile:mx-auto`}
        style={{ width: boardSize.boardWidth }}
      >
        {rows}
      </div>
    </div>
  );
}
