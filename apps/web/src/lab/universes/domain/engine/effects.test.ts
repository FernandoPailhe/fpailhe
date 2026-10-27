import { describe, expect, it } from "vitest";
import type { Branch, Effect, Parameter, Power } from "../models";
import { applyEffects } from "./effects";
import { makeContent, makeEngineContext, makeSession } from "./testing";

const T0 = "2026-01-01T00:00:00.000Z";

function param(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: "p1",
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: "p1",
    name: { default: "P1" },
    min: 0,
    max: 100,
    initialValue: 50,
    thresholds: [],
    ...overrides,
  };
}

function power(overrides: Partial<Power> = {}): Power {
  return {
    id: "pw1",
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: "pw1",
    name: { default: "PW1" },
    kind: "shield",
    blocksThreatTags: ["fire"],
    ...overrides,
  } as Power;
}

function branch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: "b1",
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: "b1",
    name: { default: "B1" },
    ...overrides,
  };
}

const ec = makeEngineContext();

describe("applyEffects — modify_parameter / set_parameter", () => {
  it("aplica delta y clampea a [min, max]", () => {
    const content = makeContent({ parameters: [param()] });
    const session = makeSession({ parameters: { p1: 95 } });
    const { session: s2, events } = applyEffects(
      content,
      session,
      [{ type: "modify_parameter", parameterId: "p1", delta: 20 }],
      ec,
    );
    expect(s2.parameters["p1"]).toBe(100);
    expect(events).toContainEqual({
      type: "parameter_changed",
      parameterId: "p1",
      from: 95,
      to: 100,
      delta: 5,
    });
  });

  it("clampea por abajo a min", () => {
    const content = makeContent({ parameters: [param()] });
    const session = makeSession({ parameters: { p1: 3 } });
    const { session: s2 } = applyEffects(
      content,
      session,
      [{ type: "modify_parameter", parameterId: "p1", delta: -10 }],
      ec,
    );
    expect(s2.parameters["p1"]).toBe(0);
  });

  it("no emite evento si el valor no cambió", () => {
    const content = makeContent({ parameters: [param()] });
    const session = makeSession({ parameters: { p1: 100 } });
    const { events } = applyEffects(
      content,
      session,
      [{ type: "modify_parameter", parameterId: "p1", delta: 10 }],
      ec,
    );
    expect(events).toHaveLength(0);
  });

  it("ignora parámetros desconocidos; actualiza inactivos sin romper", () => {
    const content = makeContent({ parameters: [param()] });
    const session = makeSession({ parameters: { p1: 50 }, activeParameterIds: [] });
    const { session: s2 } = applyEffects(
      content,
      session,
      [
        { type: "modify_parameter", parameterId: "fantasma", delta: 5 },
        { type: "modify_parameter", parameterId: "p1", delta: -30 },
        { type: "set_parameter", parameterId: "p1", value: 120 },
      ],
      ec,
    );
    expect(s2.parameters["p1"]).toBe(100);
  });

  it("aplica modifiers: signo, parameterId y multiplicador compuesto", () => {
    const content = makeContent({
      parameters: [param()],
      powers: [
        power({ id: "m1", kind: "modifier", multiplier: 2, appliesTo: "positive" }),
        power({ id: "m2", kind: "modifier", multiplier: 1.5, appliesTo: "negative", parameterId: "p1" }),
        power({ id: "m3", kind: "modifier", multiplier: 3, appliesTo: "both", parameterId: "otro" }),
      ],
    });
    const session = makeSession({
      parameters: { p1: 50 },
      powers: [
        { powerId: "m1", charges: 1 },
        { powerId: "m2", charges: 1 },
        { powerId: "m3", charges: 1 },
      ],
    });
    const { session: sPos } = applyEffects(
      content,
      session,
      [{ type: "modify_parameter", parameterId: "p1", delta: 5 }],
      ec,
    );
    expect(sPos.parameters["p1"]).toBe(60); // 5 × 2 (m3 no aplica: parameterId distinto)
    const { session: sNeg } = applyEffects(
      content,
      session,
      [{ type: "modify_parameter", parameterId: "p1", delta: -4 }],
      ec,
    );
    expect(sNeg.parameters["p1"]).toBe(44); // -4 × 1.5 = -6
  });
});

describe("applyEffects — activación, score, flags, ramas, personajes", () => {
  it("activate/deactivate sin duplicar y con eventos", () => {
    const content = makeContent();
    const session = makeSession({ activeParameterIds: ["p1"] });
    const { session: s2, events } = applyEffects(
      content,
      session,
      [
        { type: "activate_parameter", parameterId: "p1" },
        { type: "activate_parameter", parameterId: "p2" },
        { type: "deactivate_parameter", parameterId: "p1" },
        { type: "deactivate_parameter", parameterId: "p9" },
      ],
      ec,
    );
    expect(s2.activeParameterIds).toEqual(["p2"]);
    expect(events).toEqual([
      { type: "parameter_activated", parameterId: "p2" },
      { type: "parameter_deactivated", parameterId: "p1" },
    ]);
  });

  it("add_score suma y emite; 0 no emite", () => {
    const { session: s2, events } = applyEffects(
      makeContent(),
      makeSession({ score: 10 }),
      [
        { type: "add_score", points: 5 },
        { type: "add_score", points: 0 },
      ],
      ec,
    );
    expect(s2.score).toBe(15);
    expect(events).toEqual([{ type: "score_changed", from: 10, to: 15 }]);
  });

  it("set_flag escribe en flags", () => {
    const { session: s2 } = applyEffects(
      makeContent(),
      makeSession(),
      [{ type: "set_flag", flag: "f", value: "v" }],
      ec,
    );
    expect(s2.flags["f"]).toBe("v");
  });

  it("enter_branch con exclusiveGroup saca a las hermanas", () => {
    const content = makeContent({
      branches: [
        branch({ id: "b1", exclusiveGroup: "camino" }),
        branch({ id: "b2", exclusiveGroup: "camino" }),
        branch({ id: "b3", exclusiveGroup: "otro" }),
      ],
    });
    const session = makeSession({ branchIds: ["b1", "b3"] });
    const { session: s2, events } = applyEffects(
      content,
      session,
      [{ type: "enter_branch", branchId: "b2" }],
      ec,
    );
    expect(s2.branchIds).toEqual(["b3", "b2"]);
    expect(events).toEqual([
      { type: "branch_left", branchId: "b1" },
      { type: "branch_entered", branchId: "b2" },
    ]);
  });

  it("lock/unlock_character con eventos", () => {
    const session = makeSession({ unlockedCharacterIds: ["c1"] });
    const { session: s2, events } = applyEffects(
      makeContent(),
      session,
      [
        { type: "unlock_character", characterId: "c2" },
        { type: "lock_character", characterId: "c1" },
      ],
      ec,
    );
    expect(s2.unlockedCharacterIds).toEqual(["c2"]);
    expect(events).toEqual([
      { type: "character_unlocked", characterId: "c2" },
      { type: "character_locked", characterId: "c1" },
    ]);
  });
});

describe("applyEffects — poderes, insignias, cola", () => {
  it("grant_power suma cargas y respeta maxCharges", () => {
    const content = makeContent({
      powers: [power({ id: "pw1", maxCharges: 2 })],
    });
    const session = makeSession({ powers: [{ powerId: "pw1", charges: 1 }] });
    const { session: s2, events } = applyEffects(
      content,
      session,
      [{ type: "grant_power", powerId: "pw1", charges: 5 }],
      ec,
    );
    expect(s2.powers).toEqual([{ powerId: "pw1", charges: 2 }]);
    expect(events).toEqual([{ type: "power_granted", powerId: "pw1", charges: 2 }]);
  });

  it("consume_power a 0 elimina la entrada; sin el poder es no-op", () => {
    const session = makeSession({ powers: [{ powerId: "pw1", charges: 1 }] });
    const { session: s2, events } = applyEffects(
      makeContent(),
      session,
      [
        { type: "consume_power", powerId: "pw1" },
        { type: "consume_power", powerId: "pw9" },
      ],
      ec,
    );
    expect(s2.powers).toEqual([]);
    expect(events).toEqual([{ type: "power_consumed", powerId: "pw1", charges: 0 }]);
  });

  it("award_badge no duplica", () => {
    const { session: s2 } = applyEffects(
      makeContent(),
      makeSession({ earnedBadgeIds: ["b1"] }),
      [
        { type: "award_badge", badgeId: "b1" },
        { type: "award_badge", badgeId: "b2" },
      ],
      ec,
    );
    expect(s2.earnedBadgeIds).toEqual(["b1", "b2"]);
  });

  it("enqueue_card calcula dueTurn y emite", () => {
    const { session: s2, events } = applyEffects(
      makeContent(),
      makeSession({ turn: 7 }),
      [
        { type: "enqueue_card", cardId: "c1" },
        { type: "enqueue_card", cardId: "c2", delayTurns: 4 },
      ],
      ec,
    );
    expect(s2.cardQueue).toEqual([
      { cardId: "c1", dueTurn: 8 },
      { cardId: "c2", dueTurn: 11 },
    ]);
    expect(events).toEqual([
      { type: "card_enqueued", cardId: "c1", dueTurn: 8 },
      { type: "card_enqueued", cardId: "c2", dueTurn: 11 },
    ]);
  });
});

describe("applyEffects — end_game y shields", () => {
  const defeat: Effect = { type: "end_game", outcome: "defeat", endingKey: "fin" };

  it("end_game termina y corta los efectos siguientes (regla 2)", () => {
    const { session: s2, events } = applyEffects(
      makeContent({ parameters: [param()] }),
      makeSession({ parameters: { p1: 50 } }),
      [defeat, { type: "modify_parameter", parameterId: "p1", delta: 99 }],
      ec,
    );
    expect(s2.status).toBe("lost");
    expect(s2.endingKey).toBe("fin");
    expect(s2.endedAt).toBeDefined();
    expect(s2.parameters["p1"]).toBe(50); // el efecto posterior no corrió
    expect(events).toEqual([{ type: "game_ended", outcome: "defeat", endingKey: "fin" }]);
  });

  it("end_game con threatTags es absorbido por un shield compatible", () => {
    const content = makeContent({ powers: [power()] });
    const session = makeSession({
      powers: [{ powerId: "pw1", charges: 2 }],
      parameters: {},
    });
    const { session: s2, events } = applyEffects(
      content,
      session,
      [{ type: "end_game", outcome: "defeat", threatTags: ["fire"] }],
      ec,
    );
    expect(s2.status).toBe("active");
    expect(s2.powers).toEqual([{ powerId: "pw1", charges: 1 }]);
    expect(events).toEqual([
      { type: "power_consumed", powerId: "pw1", charges: 1 },
      { type: "shield_used", powerId: "pw1" },
    ]);
  });

  it("los threatTags de la opción también habilitan el shield (regla 4)", () => {
    const content = makeContent({ powers: [power()] });
    const session = makeSession({ powers: [{ powerId: "pw1", charges: 1 }] });
    const { session: s2 } = applyEffects(
      content,
      session,
      [{ type: "end_game", outcome: "defeat" }],
      ec,
      { threatTags: ["fire"] },
    );
    expect(s2.status).toBe("active");
    expect(s2.powers).toEqual([]);
  });

  it("shield sin tag compatible no absorbe", () => {
    const content = makeContent({ powers: [power()] });
    const session = makeSession({ powers: [{ powerId: "pw1", charges: 1 }] });
    const { session: s2 } = applyEffects(
      content,
      session,
      [{ type: "end_game", outcome: "victory", threatTags: ["water"], endingKey: "v" }],
      ec,
    );
    expect(s2.status).toBe("won");
    expect(s2.powers).toEqual([{ powerId: "pw1", charges: 1 }]);
  });

  it("con varios shields aplicables usa el de menos cargas", () => {
    const content = makeContent({
      powers: [power({ id: "pw1" }), power({ id: "pw2" })],
    });
    const session = makeSession({
      powers: [
        { powerId: "pw1", charges: 3 },
        { powerId: "pw2", charges: 1 },
      ],
    });
    const { session: s2, events } = applyEffects(
      content,
      session,
      [{ type: "end_game", outcome: "defeat", threatTags: ["fire"] }],
      ec,
    );
    expect(s2.status).toBe("active");
    expect(s2.powers).toEqual([{ powerId: "pw1", charges: 3 }]);
    expect(events).toContainEqual({ type: "shield_used", powerId: "pw2" });
  });

  it("inmutabilidad: la sesión de entrada no cambia", () => {
    const session = Object.freeze(makeSession({ parameters: { p1: 50 } }));
    const { session: s2 } = applyEffects(
      makeContent({ parameters: [param()] }),
      session,
      [{ type: "modify_parameter", parameterId: "p1", delta: 10 }],
      ec,
    );
    expect(s2).not.toBe(session);
    expect(session.parameters["p1"]).toBe(50);
  });
});
