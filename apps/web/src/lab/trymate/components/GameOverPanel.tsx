import { useGameStore } from "../application/GameState";
import { GamePhase } from "../domain/constants/GameRules";

/** Resultado de la partida + reinicio. Solo se monta en GAME_OVER. */
export function GameOverPanel() {
  const { gamePhase, setupMode, player1State, player2State, reset } = useGameStore();

  if (gamePhase !== GamePhase.GAME_OVER) return null;

  const p1 = player1State.getScore();
  const p2 = player2State.getScore();
  const result = p1 > p2 ? "White wins" : p2 > p1 ? "Black wins" : "Draw";

  return (
    <section
      role="status"
      aria-label="Game result"
      className="mx-auto w-full max-w-[420px] border border-line bg-surface px-6 py-5 text-center"
    >
      <h2 className="font-display text-2xl font-bold text-ink">{result}</h2>
      <p className="mt-1 font-ui text-sm text-ink-dim">
        Final score — White {p1} — {p2} Black
      </p>
      <button
        type="button"
        onClick={() => reset(setupMode)}
        className="mt-4 border border-line bg-surface-raised px-4 py-2 font-ui text-sm font-semibold text-ink hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Play again
      </button>
    </section>
  );
}
