import { useGameStore } from "../application/GameState";
import { GameMode, GamePhase, SetupTurnMode } from "../domain/constants/GameRules";
import { PHASE_LABEL, PLAYER_LABEL } from "../lib/gameDisplay";

/**
 * Barra de estado: fase, turno, marcador y avisos (historial, sin
 * movimientos legales). Acciones secundarias: reset y quick start.
 */
export function GameStatusBar() {
  const {
    gamePhase,
    setupMode,
    currentPlayer,
    player1State,
    player2State,
    isViewingHistory,
    lastPassedPlayer,
    gameMode,
    localPlayer,
    isLocalPlayerTurn,
    reset,
    quickStart,
  } = useGameStore();

  const online = gameMode === GameMode.ONLINE;
  const vsComputer = gameMode === GameMode.VS_COMPUTER;
  const hiddenSetup = gamePhase === GamePhase.SETUP && setupMode === SetupTurnMode.HIDDEN;
  const turnLabel =
    online || vsComputer
      ? isLocalPlayerTurn()
        ? "Your turn"
        : online
          ? "Opponent's turn"
          : "Computer is thinking…"
      : `${PLAYER_LABEL[currentPlayer]} to move`;

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 font-ui text-sm">
      <div aria-live="polite" className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-ink">{PHASE_LABEL[gamePhase]}</span>
        <span className="text-ink-dim">{turnLabel}</span>
        {hiddenSetup && (
          <span className="bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-bright">
            Hidden setup — {PLAYER_LABEL[currentPlayer]} placing army
          </span>
        )}
        {(online || vsComputer) && localPlayer && (
          <span className="bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-bright">
            You are {PLAYER_LABEL[localPlayer]}
          </span>
        )}
        <span className="text-ink">
          White {player1State.getScore()} — {player2State.getScore()} Black
        </span>
        {isViewingHistory && (
          <span className="bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-bright">
            Viewing history — controls locked
          </span>
        )}
        {lastPassedPlayer && (
          <span className="bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-bright">
            {PLAYER_LABEL[lastPassedPlayer]} had no legal moves — turn passed
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {gamePhase === GamePhase.SETUP && !online && (
          <button
            type="button"
            onClick={() => quickStart()}
            className="text-xs text-ink-dim underline underline-offset-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Quick start
          </button>
        )}
        {!online && (
          <button
            type="button"
            onClick={() => reset(setupMode)}
            className="text-xs text-ink-dim underline underline-offset-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
