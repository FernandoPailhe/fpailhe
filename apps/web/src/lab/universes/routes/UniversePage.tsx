import { useNavigate, useParams } from "react-router-dom";

import { useNarrativeGame } from "../application";
import { ErrorScreen, LoadingScreen, StartScreen } from "../components";
import { titleFor, useDocumentTitle } from "../lib/seo";

export function UniversePage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const game = useNarrativeGame(slug);
  useDocumentTitle(titleFor("universe", game.title || undefined));

  if (game.phase === "loading") return <LoadingScreen />;
  if (game.phase === "error") {
    return <ErrorScreen notFound={game.notFound} onRetry={game.retry} />;
  }

  const playUrl = `/lab/universes/${slug}/jugar`;
  const startAndPlay = () => {
    game.startNewGame();
    navigate(playUrl);
  };

  return (
    <StartScreen
      game={game}
      onPlay={startAndPlay}
      onContinue={() => navigate(playUrl)}
      onNew={startAndPlay}
      onSeeEnd={() => navigate(`/lab/universes/${slug}/final`)}
    />
  );
}
