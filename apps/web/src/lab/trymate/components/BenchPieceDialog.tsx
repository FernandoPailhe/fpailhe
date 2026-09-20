import { Dialog } from "@ferpa/ui";
import { useGameStore } from "../application/GameState";
import { GameMode, GamePhase } from "../domain/constants/GameRules";
import { PIECE_LABEL } from "../lib/gameDisplay";
import { PieceToken } from "./PieceToken";

/**
 * Modal bloqueante para colocar una pieza de la banca (issue #21): cuando el
 * jugador actual puede colocar (`canPlaceBenchPiece` — PLAYING, menos de
 * PIECES_TO_PLACE propias en el tablero y banca no vacía) y aún no eligió cuál,
 * se abre y bloquea el juego hasta que seleccione. La casilla destino se elige
 * después sobre el tablero (las válidas quedan resaltadas).
 * En ONLINE solo se abre en el turno del jugador local.
 */
export function BenchPieceDialog() {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const gameMode = useGameStore((s) => s.gameMode);
  const localPlayer = useGameStore((s) => s.localPlayer);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const selectedBenchPiece = useGameStore((s) => s.selectedBenchPiece);
  const isViewingHistory = useGameStore((s) => s.isViewingHistory);
  const canPlaceBenchPiece = useGameStore((s) => s.canPlaceBenchPiece);
  const getCurrentPlayerState = useGameStore((s) => s.getCurrentPlayerState);
  const selectBenchPiece = useGameStore((s) => s.selectBenchPiece);

  const isLocalTurn =
    gameMode !== GameMode.ONLINE || localPlayer === null || localPlayer === currentPlayer;
  const open =
    isLocalTurn &&
    !isViewingHistory &&
    gamePhase === GamePhase.PLAYING &&
    selectedBenchPiece === null &&
    canPlaceBenchPiece();

  const benchPieces = getCurrentPlayerState().getBenchPieces();

  return (
    <Dialog open={open} onClose={() => {}} blocking labelledBy="bench-piece-title">
      <div className="border border-line bg-surface px-6 py-5">
        <h2 id="bench-piece-title" className="font-display text-xl font-bold text-ink">
          Place a bench piece
        </h2>
        <p className="mt-1 font-ui text-sm text-ink-dim">
          Choose a piece, then click a highlighted square
        </p>
        <ul className="mt-4 flex gap-3">
          {benchPieces.map((piece) => (
            <li key={piece.id}>
              <button
                type="button"
                aria-label={`Place bench ${PIECE_LABEL[piece.type]}`}
                onClick={() => selectBenchPiece(piece)}
                className="flex h-14 w-14 flex-col items-center border border-line bg-surface px-3 py-2 transition-colors hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <PieceToken type={piece.type} owner={piece.owner} />
                <span className="sr-only">{PIECE_LABEL[piece.type]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
