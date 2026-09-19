import { useGameStore } from "../application/GameState";
import { GamePhase } from "../domain/constants/GameRules";
import { PHASE_LABEL, PLAYER_LABEL } from "../lib/gameDisplay";

/**
 * Barra de estado: fase, turno, marcador y avisos (historial, sin
 * movimientos legales). Acciones secundarias: reset y quick start.
 */
export function GameStatusBar() {
  const {
    gamePhase,
    currentPlayer,
    player1State,
    player2State,
    isViewingHistory,
    board,
    movementEngine,
    canPlaceBenchPiece,
    reset,
    quickStart,
  } = useGameStore();

  const noLegalMoves =
    gamePhase === GamePhase.PLAYING &&
    !board
      .getAllPieces()
      .filter((p) => p.owner === currentPlayer)
      .some((p) => movementEngine.getValidMoves(p, board).length > 0) &&
    !canPlaceBenchPiece();

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-wrap items-center justify-between gap-2 font-ui text-sm">
      <div aria-live="polite" className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-ink">{PHASE_LABEL[gamePhase]}</span>
        <span className="text-ink-dim">{PLAYER_LABEL[currentPlayer]} to move</span>
        <span className="text-ink">
          White {player1State.getScore()} — {player2State.getScore()} Black
        </span>
        {isViewingHistory && (
          <span className="bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-bright">
            Viewing history — controls locked
          </span>
        )}
        {noLegalMoves && (
          <span className="bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-bright">
            No legal moves — bench or move required
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {gamePhase === GamePhase.SETUP && (
          <button
            type="button"
            onClick={quickStart}
            className="text-xs text-ink-dim underline underline-offset-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Quick start
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="text-xs text-ink-dim underline underline-offset-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
