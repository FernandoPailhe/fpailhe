import { useQuery } from "@tanstack/react-query";
import { listUniverses } from "../infrastructure/registry";
import { universeKeys } from "./keys";

/** Lista los universos disponibles (publicados; borradores solo en DEV). */
export function useUniverses() {
  return useQuery({
    queryKey: universeKeys.list(),
    queryFn: () => listUniverses(),
    staleTime: Infinity,
  });
}
