import { UnknownUniverseError } from "../infrastructure/errors";
import { useUniverseContentQuery } from "./useUniverseContentQuery";

/** Envuelve la query de contenido y traduce el error a `notFound`. */
export function useNarrativeContent(slug: string, options?: { enabled?: boolean }) {
  const query = useUniverseContentQuery(slug, options);
  return {
    content: query.data,
    isLoading: query.isLoading,
    error: query.error,
    notFound: query.error instanceof UnknownUniverseError,
  };
}
