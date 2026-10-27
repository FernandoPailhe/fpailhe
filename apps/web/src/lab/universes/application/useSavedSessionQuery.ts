import { useQuery } from "@tanstack/react-query";
import type { ID } from "../domain/models";
import { getUniverseRepositories } from "../infrastructure/repositories";
import { universeKeys } from "./keys";

/**
 * Lee la partida guardada para hidratar el store una vez;
 * después de hidratar, manda el store.
 */
export function useSavedSessionQuery(userId: ID, gameId: ID, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: universeKeys.saved(userId, gameId),
    enabled: options?.enabled ?? true,
    queryFn: () => getUniverseRepositories().sessions.load(userId, gameId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
