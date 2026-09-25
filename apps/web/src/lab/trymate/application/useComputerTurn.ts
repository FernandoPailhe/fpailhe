import { useEffect, useState } from "react";
import { useGameStore } from "./GameState";
import { GameMode, GamePhase } from "../domain/constants/GameRules";

export const BOT_DELAY_MS = { setup: 250, playing: 700 } as const;

/**
 * Cuánto tardó la última decisión async del bot (ms). Si el bot "piensa" en
 * un worker, esa espera ya es parte del ritmo del juego: la demora previa se
 * descuenta (`max(0, delay − tiempoDeBúsqueda)`) para no sumar dos esperas.
 */
let lastThinkMs = 0;

/**
 * Agenda `runBotTurnAsync` con una demora mientras sea turno del bot. La
 * banca y el setup HIDDEN no consumen turno, así que se re-agenda vía `tick`
 * hasta que la acción del bot lo deje sin turno. No-op fuera de VS_COMPUTER.
 * El cleanup aborta la búsqueda en curso (el store además descarta
 * respuestas tardías por token de turno).
 */
export function useComputerTurn(): void {
  const gameMode = useGameStore((s) => s.gameMode);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const isViewingHistory = useGameStore((s) => s.isViewingHistory);
  const botLoading = useGameStore((s) => s.botLoading);
  const moveCount = useGameStore((s) => s.moveHistory.getTotalMoves());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const s = useGameStore.getState();
    const bot = s.getBotPlayer();
    if (gameMode !== GameMode.VS_COMPUTER || !bot || currentPlayer !== bot || isViewingHistory) {
      return;
    }
    if (gamePhase === GamePhase.GAME_OVER) return;
    // Bot lazy (Hard) todavía descargando: al terminar, botLoading re-dispara
    // el efecto y agenda el turno.
    if (s.botLoading) return;

    const controller = s.botController;
    const isAsync = !!(controller?.choosePlayActionAsync ?? controller?.prepareSetupAsync);
    const baseDelay = gamePhase === GamePhase.PLAYING ? BOT_DELAY_MS.playing : BOT_DELAY_MS.setup;
    const delay = isAsync ? Math.max(0, baseDelay - lastThinkMs) : baseDelay;

    const ctl = new AbortController();
    const id = window.setTimeout(() => {
      const t0 = Date.now();
      void useGameStore
        .getState()
        .runBotTurnAsync(ctl.signal)
        .then((acted) => {
          lastThinkMs = Date.now() - t0;
          if (acted) {
            setTick((t) => t + 1); // re-evaluar: banca/setup pueden seguir en turno del bot
          } else if (import.meta.env.DEV) {
            console.warn(
              "useComputerTurn: runBotTurnAsync no produjo cambios; se frena el re-agendado",
            );
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) console.error("useComputerTurn: turno del bot falló", err);
        });
    }, delay);
    return () => {
      window.clearTimeout(id);
      ctl.abort();
    };
  }, [gameMode, currentPlayer, gamePhase, isViewingHistory, moveCount, botLoading, tick]);
}
