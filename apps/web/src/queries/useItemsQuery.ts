import { useQuery } from "@tanstack/react-query";
import { fetchItems } from "../services/dataService";
import { queryKeys } from "./keys";

export function useItemsQuery() {
  return useQuery({
    queryKey: queryKeys.items,
    queryFn: fetchItems,
    staleTime: 5 * 60_000,
  });
}
