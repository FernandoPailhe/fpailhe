import { describe, expect, it } from "vitest";
import { makeSession } from "../domain/engine/testing";
import { derivePhase } from "./derivePhase";

const active = makeSession({ currentCardId: "c1" });
const resolution = {
  cardId: "c1",
  optionId: "o1",
  events: [],
  parametersBefore: {},
  feedbackSent: false,
};

describe("derivePhase", () => {
  it("error si falló el contenido (prioridad sobre todo)", () => {
    expect(
      derivePhase({ contentStatus: "error", hydrated: true, session: active, lastResolution: resolution, hasCurrentCard: true }),
    ).toBe("error");
  });

  it("loading si falta contenido o hidratar", () => {
    expect(derivePhase({ contentStatus: "loading", hydrated: true, session: active, lastResolution: null, hasCurrentCard: true })).toBe("loading");
    expect(derivePhase({ contentStatus: "success", hydrated: false, session: active, lastResolution: null, hasCurrentCard: true })).toBe("loading");
  });

  it("no_session si no hay sesión", () => {
    expect(derivePhase({ contentStatus: "success", hydrated: true, session: null, lastResolution: null, hasCurrentCard: false })).toBe("no_session");
  });

  it("outcome si hay lastResolution", () => {
    expect(derivePhase({ contentStatus: "success", hydrated: true, session: active, lastResolution: resolution, hasCurrentCard: false })).toBe("outcome");
  });

  it("ended si la sesión terminó (sin resolución pendiente)", () => {
    const won = makeSession({ status: "won" });
    expect(derivePhase({ contentStatus: "success", hydrated: true, session: won, lastResolution: null, hasCurrentCard: false })).toBe("ended");
  });

  it("card si hay currentCardId", () => {
    expect(derivePhase({ contentStatus: "success", hydrated: true, session: active, lastResolution: null, hasCurrentCard: true })).toBe("card");
  });

  it("between si está activa sin carta", () => {
    const noCard = makeSession({ currentCardId: undefined });
    expect(derivePhase({ contentStatus: "success", hydrated: true, session: noCard, lastResolution: null, hasCurrentCard: false })).toBe("between");
  });
});
