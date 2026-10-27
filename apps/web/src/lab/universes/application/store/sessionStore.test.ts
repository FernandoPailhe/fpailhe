import { beforeEach, describe, expect, it } from "vitest";
import { makeSession } from "../../domain/engine/testing";
import { selectSlot, useSessionStore, type LastResolution } from "./sessionStore";

const session = () => makeSession({ gameId: "g1" });
const resolution = (): LastResolution => ({
  cardId: "c1",
  optionId: "o1",
  events: [],
  parametersBefore: { p1: 50 },
  feedbackSent: false,
});

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("hydrate marca el slot como hidratado", () => {
    useSessionStore.getState().hydrate("demo", session());
    const slot = useSessionStore.getState().slots["demo"]!;
    expect(slot.hydrated).toBe(true);
    expect(slot.session?.gameId).toBe("g1");
    expect(slot.lastResolution).toBeNull();
  });

  it("setSession reemplaza la sesión y marca hydrated", () => {
    useSessionStore.getState().setSession("demo", session());
    expect(useSessionStore.getState().slots["demo"]!.session).not.toBeNull();
    expect(useSessionStore.getState().slots["demo"]!.hydrated).toBe(true);
  });

  it("setResolution y markFeedbackSent", () => {
    useSessionStore.getState().setSession("demo", session());
    useSessionStore.getState().setResolution("demo", resolution());
    let slot = useSessionStore.getState().slots["demo"]!;
    expect(slot.lastResolution?.cardId).toBe("c1");
    useSessionStore.getState().markFeedbackSent("demo");
    slot = useSessionStore.getState().slots["demo"]!;
    expect(slot.lastResolution?.feedbackSent).toBe(true);
  });

  it("markFeedbackSent sin resolución no rompe", () => {
    useSessionStore.getState().markFeedbackSent("demo");
    expect(useSessionStore.getState().slots["demo"]).toBeUndefined();
  });

  it("slots independientes por slug", () => {
    const s1 = session();
    useSessionStore.getState().setSession("a", s1);
    useSessionStore.getState().setSession("b", session());
    useSessionStore.getState().setResolution("b", resolution());
    expect(useSessionStore.getState().slots["a"]!.lastResolution).toBeNull();
    useSessionStore.getState().reset("a");
    expect(useSessionStore.getState().slots["a"]).toBeUndefined();
    expect(useSessionStore.getState().slots["b"]).toBeDefined();
  });

  it("reset() sin slug limpia todo", () => {
    useSessionStore.getState().setSession("a", session());
    useSessionStore.getState().setSession("b", session());
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().slots).toEqual({});
  });

  it("selectSlot devuelve la misma referencia para slots vacíos", () => {
    const sel = selectSlot("inexistente");
    const a = sel(useSessionStore.getState());
    useSessionStore.getState().setSession("otro", session());
    const b = sel(useSessionStore.getState());
    expect(a).toBe(b);
    expect(a.session).toBeNull();
    expect(a.hydrated).toBe(false);
  });
});
