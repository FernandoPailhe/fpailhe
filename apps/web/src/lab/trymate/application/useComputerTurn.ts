import { useEffect, useState } from "react";
import { useGameStore } from "./GameState";
import { GameMode, GamePhase } from "../domain/constants/GameRules";

export const BOT_DELAY_MS = { setup: 250, playing: 700 } as const;

/**
 * Agenda `runBotTurn` con una demora mientras sea turno del bot. La banca y
 * el setup HIDDEN no consumen turno, así que se re-agenda vía `tick` hasta
 * que la acción del bot lo deje sin turno. No-op fuera de VS_COMPUTER.
 */
export function useComputerTurn(): void {
  const gameMode = useGameStore((s) => s.gameMode);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const isViewingHistory = useGameStore((s) => s.isViewingHistory);
  const moveCount = useGameStore((s) => s.moveHistory.getTotalMoves());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const s = useGameStore.getState();
    const bot = s.getBotPlayer();
    if (gameMode !== GameMode.VS_COMPUTER || !bot || currentPlayer !== bot || isViewingHistory) {
      return;
    }
    if (gamePhase === GamePhase.GAME_OVER) return;
    const delay = gamePhase === GamePhase.PLAYING ? BOT_DELAY_MS.playing : BOT_DELAY_MS.setup;
    const id = window.setTimeout(() => {
      const acted = useGameStore.getState().runBotTurn();
      if (acted) {
        setTick((t) => t + 1); // re-evaluar: banca/setup pueden seguir en turno del bot
      } else if (import.meta.env.DEV) {
        console.warn("useComputerTurn: runBotTurn no produjo cambios; se frena el re-agendado");
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [gameMode, currentPlayer, gamePhase, isViewingHistory, moveCount, tick]);
}
