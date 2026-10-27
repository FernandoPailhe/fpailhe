export const universeKeys = {
  all: ["universes"] as const,
  list: () => [...universeKeys.all, "list"] as const,
  content: (slug: string) => [...universeKeys.all, "content", slug] as const,
  saved: (userId: string, gameId: string) =>
    [...universeKeys.all, "saved", userId, gameId] as const,
};
