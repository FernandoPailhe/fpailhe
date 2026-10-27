import { Navigate, useParams } from "react-router-dom";

import { useNarrativeGame } from "../application";
import {
  ErrorScreen,
  Hud,
  LiveAnnouncer,
  LoadingScreen,
  OptionList,
  OutcomePanel,
  SituationCard,
  useTwoStepConfirm,
} from "../components";
import { useOptionHotkeys } from "../components/useOptionHotkeys";
import { uiCopy } from "../lib/copy";
import { titleFor, useDocumentTitle } from "../lib/seo";
import { redirectFor } from "./universesRouting";

export function UniversePlayPage() {
  const { slug = "" } = useParams();
  const game = useNarrativeGame(slug, { autoStartTurn: true });
  useDocumentTitle(titleFor("play", game.title || undefined), { noindex: true });

  useOptionHotkeys(game.card?.options ?? [], game.choose, game.phase === "card");
  const abandon = useTwoStepConfirm(game.abandon);

  const redirect = redirectFor(slug, "play", game.phase);
  if (redirect) return <Navigate to={redirect} replace />;
  if (game.phase === "loading" || game.phase === "between") return <LoadingScreen />;
  if (game.phase === "error") {
    if (game.notFound) return <Navigate to={`/lab/universes/${slug}`} replace />;
    return <ErrorScreen notFound={false} onRetry={game.retry} />;
  }

  return (
    <section>
      <h1 className="uv-sr-only">{game.title}</h1>
      <Hud
        stage={game.stage}
        turn={game.turn}
        score={game.score}
        parameters={game.parameters}
        powers={game.powers}
        icons={game.icons}
      />

      {game.phase === "card" && game.card && (
        <>
          <SituationCard key={game.card.id} card={game.card} mark={game.title[0]} />
          <OptionList options={game.card.options} onChoose={game.choose} />
          <p className="uv-hotkey-hint">{uiCopy.card.hotkeyHint}</p>
        </>
      )}

      {game.phase === "outcome" && game.outcome && (
        <>
          <OutcomePanel outcome={game.outcome} onContinue={game.next} />
          <LiveAnnouncer
            message={[
              uiCopy.outcome.chosen(game.outcome.chosenLabel),
              ...game.outcome.events.map((e) => e.text),
            ].join(". ")}
          />
        </>
      )}

      <button
        type="button"
        className="uv-btn uv-btn--ghost uv-danger"
        onClick={abandon.confirm}
        onKeyDown={abandon.onKeyDown}
        onBlur={abandon.onBlur}
      >
        {abandon.armed ? uiCopy.card.confirmAbandon : uiCopy.card.abandon}
      </button>
    </section>
  );
}
