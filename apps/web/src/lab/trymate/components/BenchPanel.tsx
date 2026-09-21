import { useGameStore } from "../application/GameState";
import { PIECE_LABEL, PLAYER_LABEL } from "../lib/gameDisplay";
import { PieceToken } from "./PieceToken";

export interface BenchPanelProps {
  /** Ancho en píxeles para alinear la banca con el tablero (misma medida). */
  width?: number;
}

/**
 * Banca del jugador actual (fase PLAYING). Colocar una pieza de banca es
 * una acción gratuita: no consume el turno.
 */
export function BenchPanel({ width }: BenchPanelProps) {
  const {
    currentPlayer,
    getCurrentPlayerState,
    selectBenchPiece,
    selectedBenchPiece,
    canPlaceBenchPiece,
  } = useGameStore();

  const benchPieces = getCurrentPlayerState().getBenchPieces();
  if (benchPieces.length === 0) return null;

  const placeable = canPlaceBenchPiece();

  return (
    <section
      aria-label={`${PLAYER_LABEL[currentPlayer]} bench`}
      className="ml-auto w-full mobile:mx-auto"
      style={width ? { maxWidth: width } : undefined}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-ui text-sm font-semibold text-ink">
          {PLAYER_LABEL[currentPlayer]} bench
        </h2>
        <p className="font-ui text-xs text-ink-dim">
          Bench placement is a free action — it does not end your turn
        </p>
      </div>
      <ul className="mt-3 flex gap-3">
        {benchPieces.map((piece) => {
          const isSelected = selectedBenchPiece?.id === piece.id;
          return (
            <li key={piece.id}>
              <button
                type="button"
                disabled={!placeable}
                aria-pressed={isSelected}
                aria-label={`Place bench ${PIECE_LABEL[piece.type]}`}
                onClick={() => selectBenchPiece(piece)}
                className={`flex h-14 w-14 flex-col items-center disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                  isSelected ? "ring-2 ring-gold-bright" : ""
                }`}
              >
                <PieceToken type={piece.type} owner={piece.owner} />
                <span className="sr-only">{PIECE_LABEL[piece.type]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
