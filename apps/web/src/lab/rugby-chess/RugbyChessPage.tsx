import { Nav } from "../../components";
import { RugbyChessBoard } from "./components/RugbyChessBoard";
import { PiecePickerDialog } from "./components/PiecePickerDialog";
import { BenchPanel } from "./components/BenchPanel";
import { GameStatusBar } from "./components/GameStatusBar";
import { GameOverPanel } from "./components/GameOverPanel";
import { MoveHistoryPanel } from "./components/MoveHistoryPanel";
import { useGameStore } from "./application/GameState";
import { GamePhase } from "./domain/constants/GameRules";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "CV", href: "/cv" },
];

/**
 * Página del módulo rugby-chess (ruta `/lab/rugby-chess`).
 * Módulo independiente: su dominio y componentes viven en esta carpeta.
 */
export function RugbyChessPage() {
  const gamePhase = useGameStore((s) => s.gamePhase);

  return (
    <>
      <Nav links={NAV_LINKS} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex max-w-[880px] flex-col gap-6 px-[clamp(20px,5vw,32px)] py-10"
      >
        <header>
          <p className="font-ui text-xs uppercase tracking-widest text-gold-bright">Lab</p>
          <h1 className="font-display text-3xl font-bold text-ink">Rugby Chess</h1>
          <p className="mt-2 text-ink-dim">
            Experimental module: chess-like tactics on a 5×11 rugby field.
          </p>
        </header>
        <GameStatusBar />
        {gamePhase === GamePhase.PLAYING && <BenchPanel />}
        <RugbyChessBoard />
        {(gamePhase === GamePhase.PLAYING || gamePhase === GamePhase.GAME_OVER) && (
          <MoveHistoryPanel />
        )}
        {gamePhase === GamePhase.GAME_OVER && <GameOverPanel />}
      </main>
      <PiecePickerDialog />
    </>
  );
}
