import { describe, expect, it } from "vitest";
import { assembleGameContent } from "../domain/engine/content";
import { listOptions } from "../domain/engine/options";
import { createSequentialId, createSeededRng } from "../domain/engine/rng";
import type { EngineContext } from "../domain/engine/types";
import { loadFixtureBundle } from "../testing/loadFixtureBundle";
import {
  abandonTransition,
  chooseTransition,
  nextTransition,
  startNewGameTransition,
} from "./transitions";

const content = assembleGameContent(loadFixtureBundle());

function ecOf(seed: number): EngineContext {
  return {
    rng: createSeededRng(seed),
    now: () => "2026-01-01T00:00:00.000Z",
    newId: createSequentialId(`tr_${seed}_`),
  };
}

describe("transitions sobre demo-reino", () => {
  it("una partida completa con semilla fija termina", () => {
    const ec = ecOf(7);
    let { session } = startNewGameTransition(content, { userId: "u1", locale: "es" }, ec);
    expect(session.status).toBe("active");
    expect(session.currentCardId).toBeDefined();

    let turns = 0;
    while (session.status === "active" && turns < 500) {
      const card = content.cards.find((c) => c.id === session.currentCardId)!;
      const option = listOptions(card, session, content).find((o) => o.state === "available")!;
      const { session: next, resolution } = chooseTransition(
        content,
        session,
        { optionId: option.option.id, shownAt: ec.now() },
        ec,
      );
      expect(resolution.cardId).toBe(card.id);
      expect(resolution.parametersBefore).toBeDefined();
      session = nextTransition(content, next, ec).session;
      turns++;
    }
    expect(session.status).not.toBe("active");
    expect(turns).toBeLessThan(500);
  });

  it("chooseTransition devuelve resolución con eventos e impresión", () => {
    const ec = ecOf(11);
    const { session } = startNewGameTransition(content, { userId: "u1", locale: "es" }, ec);
    const card = content.cards.find((c) => c.id === session.currentCardId)!;
    const option = card.options.find((o) =>
      listOptions(card, session, content).some((s) => s.option.id === o.id && s.state === "available"),
    )!;
    const { session: next, resolution, impression } = chooseTransition(
      content,
      session,
      { optionId: option.id, shownAt: ec.now(), responseTimeMs: 1234 },
      ec,
    );
    expect(resolution.optionId).toBe(option.id);
    expect(resolution.feedbackSent).toBe(false);
    expect(impression.chosenOptionId).toBe(option.id);
    expect(impression.responseTimeMs).toBe(1234);
    expect(next.turn).toBe(session.turn + 1);
    expect(next.currentCardId).toBeUndefined();
  });

  it("nextTransition sobre sesión terminada no cambia nada", () => {
    const session = { ...startNewGameTransition(content, { userId: "u1", locale: "es" }, ecOf(3)).session, status: "won" as const };
    const { session: next } = nextTransition(content, session, ecOf(3));
    expect(next).toBe(session);
  });

  it("abandonTransition deja la sesión abandoned", () => {
    const { session } = startNewGameTransition(content, { userId: "u1", locale: "es" }, ecOf(5));
    const abandoned = abandonTransition(session, ecOf(5));
    expect(abandoned.status).toBe("abandoned");
    expect(abandoned.endedAt).toBeDefined();
    expect(abandoned.currentCardId).toBeUndefined();
  });
});
