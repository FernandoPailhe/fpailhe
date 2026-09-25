import { useGameStore } from "../application/GameState";
import { Player } from "../domain/constants/PieceConstants";
import { PIECE_LABEL, PLAYER_LABEL, squareName } from "../lib/gameDisplay";
import { PieceToken } from "./PieceToken";

/**
 * Historial de movimientos navegable y de solo lectura.
 * Mientras `isViewingHistory` el tablero queda bloqueado (§4.6 del
 * PORTING_GUIDE): `handleTileClick` no-ops y la UI deshabilita el grid.
 * Las filas son compactas: número + SVG de la pieza con el color del equipo +
 * origen→destino. Sin "White"/"Black" ni nombres de pieza en el texto visible
 * (la descripción completa va en un `sr-only` por fila). El listado tiene
 * scroll propio dentro del alto que le deja el sidebar.
 */
export function MoveHistoryPanel() {
  const { moveHistory, isViewingHistory, goBackInHistory, goForwardInHistory, returnToPresent } =
    useGameStore();

  const moves = moveHistory.getAllMoves();
  const currentIndex = moveHistory.getCurrentIndex();

  return (
    <section aria-label="Move history" className="flex min-h-0 w-full flex-1 flex-col gap-2">
      {isViewingHistory && (
        <p
          role="status"
          className="bg-gold-soft px-2 py-1 font-ui text-xs font-semibold text-gold-bright"
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
          className="border border-line bg-surface px-2 py-1 font-ui text-xs text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={goForwardInHistory}
          disabled={!moveHistory.canGoForward()}
          aria-label="Go forward one move"
          className="border border-line bg-surface px-2 py-1 font-ui text-xs text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Forward →
        </button>
        {isViewingHistory && (
          <button
            type="button"
            onClick={returnToPresent}
            aria-label="Return to the live game"
            className="border border-line bg-surface-raised px-2 py-1 font-ui text-xs font-semibold text-ink hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Back to live
          </button>
        )}
      </div>
      {moves.length > 0 && (
        <div className="min-h-0 w-fit max-w-full flex-1 overflow-hidden border border-line bg-surface">
          <ol className="h-full overflow-y-auto px-2 py-1.5">
            {moves.map((m, i) => {
              const capturedOwner = m.player === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
              const description =
                `Move ${m.moveNumber}: ${PLAYER_LABEL[m.player]} ${PIECE_LABEL[m.pieceType]} ` +
                `from ${squareName(m.from)} to ${squareName(m.to)}` +
                (m.captured ? `, captures ${PIECE_LABEL[m.captured.pieceType]}` : "");
              return (
                <li
                  key={m.moveNumber}
                  aria-current={i === currentIndex ? "step" : undefined}
                  className={`flex items-center gap-2 px-1 py-0.5 ${
                    i === currentIndex ? "bg-gold-soft" : ""
                  }`}
                >
                  <span className="sr-only">{description}</span>
                  <span
                    aria-hidden="true"
                    className="w-6 shrink-0 text-right font-mono text-[10px] text-ink-dim"
                  >
                    {m.moveNumber}
                  </span>
                  <span aria-hidden="true" className="h-5 w-5 shrink-0">
                    <PieceToken type={m.pieceType} owner={m.player} />
                  </span>
                  <span aria-hidden="true" className="font-mono text-xs text-ink-dim">
                    {squareName(m.from)}→{squareName(m.to)}
                  </span>
                  {m.captured ? (
                    <span
                      aria-hidden="true"
                      className="flex items-center gap-0.5 font-ui text-xs text-ink-dim"
                    >
                      ×
                      <span className="h-4 w-4">
                        <PieceToken type={m.captured.pieceType} owner={capturedOwner} />
                      </span>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
