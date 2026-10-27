import { describe, expect, it } from "vitest";
import { getUniverseRepositories } from "./repositories";

describe("getUniverseRepositories", () => {
  it("devuelve la misma instancia memoizada con los 4 puertos", () => {
    const a = getUniverseRepositories();
    const b = getUniverseRepositories();
    expect(a).toBe(b);
    expect(typeof a.content.getGameBySlug).toBe("function");
    expect(typeof a.cards.getPublishedCards).toBe("function");
    expect(typeof a.feedback.recordImpression).toBe("function");
    expect(typeof a.sessions.load).toBe("function");
  });

  it("feedback no-op resuelve sin lanzar", async () => {
    const { feedback } = getUniverseRepositories();
    await expect(feedback.submitFeedback({} as never)).resolves.toBeUndefined();
    await expect(feedback.recordImpression({} as never)).resolves.toBeUndefined();
  });
});
