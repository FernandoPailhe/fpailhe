import { Navigate, useNavigate, useParams } from "react-router-dom";

import { useNarrativeGame } from "../application";
import { EndScreen, ErrorScreen, LoadingScreen } from "../components";
import { titleFor, useDocumentTitle } from "../lib/seo";
import { redirectFor } from "./universesRouting";

export function UniverseEndPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const game = useNarrativeGame(slug);
  useDocumentTitle(titleFor("end", game.title || undefined), { noindex: true });

  const redirect = redirectFor(slug, "end", game.phase);
  if (redirect) return <Navigate to={redirect} replace />;
  if (game.phase === "loading") return <LoadingScreen />;
  if (game.phase === "error") {
    return <ErrorScreen notFound={game.notFound} onRetry={game.retry} />;
  }
  if (!game.end) return <Navigate to={`/lab/universes/${slug}/jugar`} replace />;

  return (
    <EndScreen
      end={game.end}
      icons={game.icons}
      onPlayAgain={() => {
        game.startNewGame();
        navigate(`/lab/universes/${slug}/jugar`);
      }}
    />
  );
}
