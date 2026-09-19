import { PieceType, Player } from "../domain/constants/PieceConstants";
import { PIECE_ASSET, PIECE_LABEL, PLAYER_LABEL } from "../lib/gameDisplay";

export interface PieceTokenProps {
  type: PieceType;
  owner: Player;
}

/**
 * Pieza del juego. Los 3 SVG son oscuros: las BLANCAS se invierten con
 * `filter: invert(1)` para distinguir el bando (decisión del plan).
 */
export function PieceToken({ type, owner }: PieceTokenProps) {
  return (
    <span className="flex h-full w-full items-center justify-center rounded-full border border-line bg-surface-raised p-[8%]">
      <img
        src={PIECE_ASSET[type]}
        alt={`${PLAYER_LABEL[owner]} ${PIECE_LABEL[type]}`}
        draggable={false}
        className="pointer-events-none block h-full w-full select-none object-contain"
        style={owner === Player.BLANCAS ? { filter: "invert(1)" } : undefined}
      />
    </span>
  );
}
