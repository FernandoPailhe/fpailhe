import { useMemo } from "react";
import { Nav } from "../../components";
import { RugbyChessBoard } from "./components/RugbyChessBoard";
import { createInitialBoard } from "./domain/engine";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "CV", href: "/cv" },
];

/**
 * Página del módulo rugby-chess (ruta `/lab/rugby-chess`).
 * Módulo independiente: su dominio y componentes viven en esta carpeta.
 */
export function RugbyChessPage() {
  const board = useMemo(() => createInitialBoard(), []);

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
            Experimental module. Turn: <span className="font-semibold">{board.turn}</span>
          </p>
        </header>
        <RugbyChessBoard board={board} />
      </main>
    </>
  );
}
