import { describe, expect, it } from "vitest";
import type { Character, Parameter } from "../models";
import { abandonSession, createSession } from "./session";
import { makeContent, makeEngineContext, makeStage } from "./testing";

const T0 = "2026-01-01T00:00:00.000Z";
const ec = makeEngineContext();

function char(overrides: Partial<Character> = {}): Character {
  return {
    id: "c1",
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: "c1",
    name: { default: "C1" },
    themeTags: [],
    unlockedByDefault: false,
    ...overrides,
  };
}

function param(id: string): Parameter {
  return {
    id,
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: id,
    name: { default: id },
    min: 0,
    max: 100,
    initialValue: 40,
    thresholds: [],
  };
}

describe("createSession", () => {
  it("inicializa todos los campos desde GameConfig", () => {
    const content = makeContent({
      parameters: [param("p1"), param("p2")],
      characters: [char({ id: "c1", unlockedByDefault: true }), char({ id: "c2" })],
    });
    content.game = {
      ...content.game,
      config: {
        recentCardsWindow: 3,
        initialActiveParameterIds: ["p1"],
        initialUnlockedCharacterIds: ["c3"],
        initialBranchIds: ["b9"],
        initialPowers: [{ powerId: "pw1", charges: 2 }],
        allowCardFeedback: false,
      },
    };
    const s = createSession(content, { userId: "usr_1", locale: "es" }, ec);
    expect(s.status).toBe("active");
    expect(s.turn).toBe(0);
    expect(s.score).toBe(0);
    expect(s.stageId).toBe("off_stage_1");
    expect(s.parameters).toEqual({ p1: 40, p2: 40 });
    expect(s.activeParameterIds).toContain("p1");
    expect(s.unlockedCharacterIds).toEqual(expect.arrayContaining(["c3", "c1"]));
    expect(s.unlockedCharacterIds).not.toContain("c2");
    expect(s.branchIds).toEqual(["b9"]);
    expect(s.powers).toEqual([{ powerId: "pw1", charges: 2 }]);
    expect(s.startedAt).toBeDefined();
    expect(s.locale).toBe("es");
  });

  it("aplica activatesParameterIds y onEnter de la etapa inicial", () => {
    const stage1 = makeStage({
      id: "off_stage_1",
      order: 1,
      activatesParameterIds: ["p2"],
      onEnter: [
        { type: "modify_parameter", parameterId: "p1", delta: 10 },
        { type: "add_score", points: 3 },
      ],
    });
    const content = makeContent({
      parameters: [param("p1"), param("p2")],
      stages: [stage1, makeStage({ id: "off_stage_2", order: 2 })],
    });
    const s = createSession(content, { userId: "u", locale: "es" }, ec);
    expect(s.activeParameterIds).toContain("p2");
    expect(s.parameters["p1"]).toBe(50);
    expect(s.score).toBe(3);
  });

  it("la etapa inicial es la de menor order", () => {
    const content = makeContent({
      stages: [
        makeStage({ id: "off_stage_b", order: 5 }),
        makeStage({ id: "off_stage_a", order: 2 }),
      ],
    });
    const s = createSession(content, { userId: "u", locale: "es" }, ec);
    expect(s.stageId).toBe("off_stage_a");
  });

  it("un threshold cumplido al entrar dispara en la sesión inicial", () => {
    const stage1 = makeStage({
      id: "off_stage_1",
      order: 1,
      activatesParameterIds: ["p1"],
      onEnter: [{ type: "set_parameter", parameterId: "p1", value: 0 }],
    });
    const p: Parameter = {
      ...param("p1"),
      thresholds: [
        {
          id: "t1",
          comparator: "lte",
          value: 0,
          effects: [{ type: "end_game", outcome: "defeat", endingKey: "fin" }],
        },
      ],
    };
    const content = makeContent({ parameters: [p], stages: [stage1] });
    const s = createSession(content, { userId: "u", locale: "es" }, ec);
    expect(s.status).toBe("lost");
    expect(s.endingKey).toBe("fin");
  });
});

describe("abandonSession", () => {
  it("marca abandoned, limpia la carta actual y setea endedAt", () => {
    const content = makeContent();
    const s = createSession(content, { userId: "u", locale: "es" }, ec);
    const s2 = abandonSession({ ...s, currentCardId: "c" }, ec);
    expect(s2.status).toBe("abandoned");
    expect(s2.currentCardId).toBeUndefined();
    expect(s2.endedAt).toBeDefined();
    expect(s.status).toBe("active"); // inmutable
  });
});
