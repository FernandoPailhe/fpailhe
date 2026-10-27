import type { NarrativeGame } from "../application/types";
import { uiCopy } from "../lib/copy";

import { useFocusOnMount } from "./useFocusOnMount";
import { useTwoStepConfirm } from "./useTwoStepConfirm";

type StartGame = Pick<NarrativeGame, "title" | "description" | "phase" | "hasSavedSession">;

/**
 * Pantalla de inicio del universo: título, descripción y CTAs según fase.
 * "Nueva partida" con partida guardada pide confirmación en dos pasos.
 */
export function StartScreen({
  game,
  onPlay,
  onContinue,
  onNew,
  onSeeEnd,
}: {
  game: StartGame;
  onPlay: () => void;
  onContinue: () => void;
  onNew: () => void;
  onSeeEnd: () => void;
}) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>(game.phase);
  const newGame = useTwoStepConfirm(onNew);

  const ended = game.phase === "ended";
  const needsConfirm = game.hasSavedSession && !ended;

  const newGameButton = (
    <button
      type="button"
      className="uv-btn uv-btn--ghost"
      onClick={needsConfirm ? newGame.confirm : onNew}
      onKeyDown={newGame.onKeyDown}
      onBlur={newGame.onBlur}
    >
      {needsConfirm && newGame.armed ? uiCopy.start.confirmNew : uiCopy.start.newGame}
    </button>
  );

  return (
    <section className="uv-start">
      <p className="uv-eyebrow">{uiCopy.start.eyebrow}</p>
      <h1 ref={titleRef} tabIndex={-1} className="uv-title">
        {game.title}
      </h1>
      <p className="uv-start-desc uv-text-dim">{game.description}</p>
      <div className="uv-actions">
        {ended ? (
          <>
            <button type="button" className="uv-btn uv-btn--primary" onClick={onSeeEnd}>
              {uiCopy.start.seeEnd}
            </button>
            {newGameButton}
          </>
        ) : game.hasSavedSession ? (
          <>
            <button type="button" className="uv-btn uv-btn--primary" onClick={onContinue}>
              {uiCopy.start.continue}
            </button>
            {newGameButton}
          </>
        ) : (
          <button type="button" className="uv-btn uv-btn--primary" onClick={onPlay}>
            {uiCopy.start.play}
          </button>
        )}
      </div>
    </section>
  );
}
