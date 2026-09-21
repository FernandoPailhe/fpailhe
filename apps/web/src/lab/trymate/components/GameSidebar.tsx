import { useGameStore } from "../application/GameState";
import { GamePhase } from "../domain/constants/GameRules";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { PLAYER_LABEL } from "../lib/gameDisplay";
import { GameStatusBar } from "./GameStatusBar";
import { MoveHistoryPanel } from "./MoveHistoryPanel";
import { PieceToken } from "./PieceToken";

export interface GameSidebarProps {
  /**
   * Alto máximo del sidebar en píxeles: se iguala al alto del tablero para
   * que la columna nunca empuje la página más allá del board.
   */
  maxHeight?: number;
}

/** Piezas restantes en la banca de cada equipo, indicadas por color. */
function BenchCounts() {
  const player1State = useGameStore((s) => s.player1State);
  const player2State = useGameStore((s) => s.player2State);

  const rows: { player: Player; count: number }[] = [
    { player: Player.BLANCAS, count: player1State.getBenchPieces().length },
    { player: Player.NEGRAS, count: player2State.getBenchPieces().length },
  ];

  return (
    <div
      aria-label="Bench pieces remaining"
      className="flex items-center gap-4 font-ui text-xs text-ink-dim"
    >
      <span className="font-semibold text-ink">Bench</span>
      {rows.map(({ player, count }) => (
        <span
          key={player}
          className="flex items-center gap-1.5"
          aria-label={`${PLAYER_LABEL[player]}: ${count} bench pieces`}
        >
          <span aria-hidden="true" className="h-4 w-4">
            <PieceToken type={PieceType.FORT} owner={player} />
          </span>
          <span aria-hidden="true">{count}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Columna lateral de la partida: marcador/estado arriba, contadores de banca
 * a continuación y el historial de jugadas ocupando el espacio restante con
 * scroll propio. El alto se limita al del tablero (`maxHeight`).
 */
export function GameSidebar({ maxHeight }: GameSidebarProps) {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const showHistory = gamePhase === GamePhase.PLAYING || gamePhase === GamePhase.GAME_OVER;

  return (
    <aside
      aria-label="Game status"
      className="flex min-h-0 w-full flex-col gap-3"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <GameStatusBar />
      <BenchCounts />
      {showHistory && <MoveHistoryPanel />}
    </aside>
  );
}
