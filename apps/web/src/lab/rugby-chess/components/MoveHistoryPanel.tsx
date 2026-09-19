import { useGameStore } from "../application/GameState";
import { PIECE_LABEL, PLAYER_LABEL, squareName } from "../lib/gameDisplay";

/**
 * Historial de movimientos navegable y de solo lectura.
 * Mientras `isViewingHistory` el tablero queda bloqueado (§4.6 del
 * PORTING_GUIDE): `handleTileClick` no-ops y la UI deshabilita el grid.
 */
export function MoveHistoryPanel() {
  const { moveHistory, isViewingHistory, goBackInHistory, goForwardInHistory, returnToPresent } =
    useGameStore();

  const moves = moveHistory.getAllMoves();
  const currentIndex = moveHistory.getCurrentIndex();

  return (
    <section aria-label="Move history" className="mx-auto w-full max-w-[420px]">
      {isViewingHistory && (
        <p
          role="status"
          className="mb-2 bg-gold-soft px-2 py-1 font-ui text-xs font-semibold text-gold-bright"
        >
          Viewing history — game controls are locked
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBackInHistory}
          disabled={!moveHistory.canGoBack()}
          aria-label="Go back one move"
          className="border border-line bg-surface px-3 py-1 font-ui text-sm text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={goForwardInHistory}
          disabled={!moveHistory.canGoForward()}
          aria-label="Go forward one move"
          className="border border-line bg-surface px-3 py-1 font-ui text-sm text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Forward →
        </button>
        {isViewingHistory && (
          <button
            type="button"
            onClick={returnToPresent}
            aria-label="Return to the live game"
            className="border border-line bg-surface-raised px-3 py-1 font-ui text-sm font-semibold text-ink hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Back to live
          </button>
        )}
      </div>
      {moves.length > 0 && (
        <ol className="mt-3 max-h-48 overflow-y-auto border border-line bg-surface px-3 py-2 font-ui text-xs text-ink-dim">
          {moves.map((m, i) => (
            <li
              key={m.moveNumber}
              aria-current={i === currentIndex ? "step" : undefined}
              className={i === currentIndex ? "font-semibold text-ink" : undefined}
            >
              #{m.moveNumber} {PLAYER_LABEL[m.player]} {PIECE_LABEL[m.pieceType]}{" "}
              {squareName(m.from)} → {squareName(m.to)}
              {m.captured ? ` captures ${PIECE_LABEL[m.captured.pieceType]}` : ""}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
