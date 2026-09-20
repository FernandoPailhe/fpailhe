import { PieceType, Player } from "../domain/constants/PieceConstants";
import { PIECE_ASSET, PIECE_LABEL, PLAYER_LABEL } from "../lib/gameDisplay";

export interface PieceTokenProps {
  type: PieceType;
  owner: Player;
}

/**
 * Pieza del juego, sin chip ni borde: solo el SVG a tamaño completo.
 * Los 3 SVG son oscuros: las BLANCAS se invierten con `filter: invert(1)`
 * para distinguir el bando (decisión del plan).
 * Las blancas llevan además un contorno oscuro: sobre el tono crema del
 * tablero (paleta #EDDABA / #AE8A68) una silueta clara se perdería.
 */
const WHITE_PIECE_FILTER =
  "invert(1) drop-shadow(0 0 1px rgba(28, 20, 12, 0.9)) drop-shadow(0 0 2px rgba(28, 20, 12, 0.45))";

export function PieceToken({ type, owner }: PieceTokenProps) {
  return (
    <span className="flex h-full w-full items-center justify-center">
      <img
        src={PIECE_ASSET[type]}
        alt={`${PLAYER_LABEL[owner]} ${PIECE_LABEL[type]}`}
        draggable={false}
        className="pointer-events-none block h-full w-full select-none object-contain"
        style={owner === Player.BLANCAS ? { filter: WHITE_PIECE_FILTER } : undefined}
      />
    </span>
  );
}
