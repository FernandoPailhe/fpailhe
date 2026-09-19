import { Nav } from "../../components";
import { RugbyChessBoard } from "./components/RugbyChessBoard";
import { useGameStore } from "./application/GameState";
import { PHASE_LABEL, PLAYER_LABEL } from "./lib/gameDisplay";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "CV", href: "/cv" },
];

/**
 * Página del módulo rugby-chess (ruta `/lab/rugby-chess`).
 * Módulo independiente: su dominio y componentes viven en esta carpeta.
 */
export function RugbyChessPage() {
  const { gamePhase, currentPlayer, player1State, player2State } = useGameStore();

  return (
    <>
      <Nav links={NAV_LINKS} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)] py-10"
      >
        <header className="mb-8">
          <p className="font-ui text-xs uppercase tracking-widest text-gold-bright">Lab</p>
          <h1 className="font-display text-3xl font-bold text-ink">Rugby Chess</h1>
          <p className="mt-2 text-ink-dim">
            {PHASE_LABEL[gamePhase]} — {PLAYER_LABEL[currentPlayer]} to move · White{" "}
            {player1State.getScore()} — {player2State.getScore()} Black
          </p>
        </header>
        <RugbyChessBoard />
      </main>
    </>
  );
}
