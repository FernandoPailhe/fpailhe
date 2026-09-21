import type { GamePiece } from "../domain/entities/GamePiece";
import type { Position } from "../domain/entities/Position";
import { GAME_CONFIG } from "../domain/constants/GameConstants";
import {
  fileLabel,
  PIECE_LABEL,
  PLAYER_LABEL,
  rankLabel,
  scoringZoneEdge,
  squareName,
} from "../lib/gameDisplay";
import { PieceToken } from "./PieceToken";

export type BoardTileState = "idle" | "selected" | "valid" | "blocked";

export interface BoardTileProps {
  position: Position;
  piece: GamePiece | undefined;
  state: BoardTileState;
  /**
   * La casilla participa de la jugada activa del historial (origen o destino
   * de la última jugada, o de la jugada seleccionada al navegar). Se pinta
   * como overlay para no pisar la paridad ni la zona de try.
   */
  isLastMove?: boolean;
  disabled: boolean;
  tabIndex: number;
  /**
   * Tablero rotado 180° (vista del jugador NEGRAS en online): invierte el
   * degradé de la zona de try y la posición visual de la columna.
   */
  flipped?: boolean;
  onSelect: () => void;
  onFocus: () => void;
}

/**
 * Casilla del tablero: `gridcell` ARIA con un `<button>` que ocupa todo.
 * El highlighting deriva del store (`selectedPiece`/`validMoves`/`blockedMoves`),
 * no de `TileState` (decisión 1 del plan). El `tabIndex` lo maneja el grid
 * (roving tabindex, patrón ARIA grid).
 */
export function BoardTile({
  position,
  piece,
  state,
  isLastMove = false,
  disabled,
  tabIndex,
  flipped = false,
  onSelect,
  onFocus,
}: BoardTileProps) {
  const name = squareName(position);
  const dataEdge = scoringZoneEdge(position.y);
  // Con el tablero rotado la fila y=10 queda abajo: la zona de try invierte
  // el borde hacia el que se apaga la casilla.
  const zoneEdge =
    flipped && dataEdge === "top" ? "bottom" : flipped && dataEdge === "bottom" ? "top" : dataEdge;
  const baseLabel = piece
    ? `${name} — ${PLAYER_LABEL[piece.owner]} ${PIECE_LABEL[piece.type]}`
    : state === "valid"
      ? `${name} — empty, legal move`
      : state === "blocked"
        ? `${name} — blocked`
        : `${name} — empty`;
  const base = zoneEdge ? `${baseLabel}, try zone` : baseLabel;
  const label = isLastMove ? `${base}, last move` : base;

  const parity = (position.x + position.y) % 2 === 1;
  // Coordenadas en el borde visual (como chess.com): número de fila en la
  // esquina superior derecha de la columna derecha, letra de columna en la
  // esquina inferior izquierda de la fila inferior. Con el tablero rotado
  // los bordes visuales corresponden a x=0 e y=BOARD_HEIGHT-1.
  const showRank = position.x === (flipped ? 0 : GAME_CONFIG.BOARD_WIDTH - 1);
  const showFile = position.y === (flipped ? GAME_CONFIG.BOARD_HEIGHT - 1 : 0);
  const coordClass = parity ? "text-pitch-alt" : "text-pitch";
  // Zona de try: degradé que se apaga hacia el borde externo y línea gold
  // en el borde interno que la separa del campo de juego.
  const zoneClass =
    zoneEdge === "top"
      ? `bg-gradient-to-t to-canvas border-b-2 border-b-gold ${parity ? "from-pitch" : "from-pitch-alt"}`
      : zoneEdge === "bottom"
        ? `bg-gradient-to-b to-canvas border-t-2 border-t-gold ${parity ? "from-pitch" : "from-pitch-alt"}`
        : parity
          ? "bg-pitch"
          : "bg-pitch-alt";
  const stateClass =
    state === "selected"
      ? "ring-2 ring-inset ring-gold-bright"
      : state === "valid" && piece
        ? "ring-2 ring-inset ring-gold"
        : "";

  return (
    <div
      role="gridcell"
      aria-colindex={flipped ? GAME_CONFIG.BOARD_WIDTH - position.x : position.x + 1}
      className={`aspect-square border border-line ${zoneClass} ${stateClass}`}
    >
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        tabIndex={tabIndex}
        data-square={`${position.x},${position.y}`}
        onClick={onSelect}
        onFocus={onFocus}
        className="relative flex h-full w-full items-center justify-center p-[6%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {isLastMove ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gold-soft ring-1 ring-inset ring-gold"
          />
        ) : null}
        {showRank ? (
          <span
            aria-hidden="true"
            className={`absolute right-[5%] top-[5%] font-ui text-[9px] font-semibold leading-none ${coordClass}`}
          >
            {rankLabel(position.y)}
          </span>
        ) : null}
        {showFile ? (
          <span
            aria-hidden="true"
            className={`absolute bottom-[5%] left-[5%] font-ui text-[9px] font-semibold leading-none ${coordClass}`}
          >
            {fileLabel(position.x)}
          </span>
        ) : null}
        {piece ? (
          <PieceToken type={piece.type} owner={piece.owner} />
        ) : state === "valid" ? (
          <span
            aria-hidden="true"
            className={`h-2/5 w-2/5 rounded-full bg-gold ring-2 ${
              parity ? "ring-pitch-alt" : "ring-pitch"
            }`}
          />
        ) : state === "blocked" ? (
          <span aria-hidden="true" className="font-ui text-ink-dim">
            ×
          </span>
        ) : null}
      </button>
    </div>
  );
}
