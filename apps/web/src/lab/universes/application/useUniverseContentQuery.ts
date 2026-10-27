import { useQuery } from "@tanstack/react-query";
import { loadGameContent } from "../infrastructure/bundledContent";
import { UnknownUniverseError } from "../infrastructure/errors";
import { getUniverseRepositories } from "../infrastructure/repositories";
import { universeKeys } from "./keys";

/** Contenido jugable completo de un universo (chunk perezoso por slug). */
export function useUniverseContentQuery(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: universeKeys.content(slug),
    enabled: options?.enabled ?? true,
    queryFn: () => {
      const repos = getUniverseRepositories();
      return loadGameContent(repos.content, repos.cards, slug);
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (failureCount, error) =>
      error instanceof UnknownUniverseError ? false : failureCount < 2,
  });
}
