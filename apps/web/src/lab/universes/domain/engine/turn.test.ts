import { describe, expect, it } from "vitest";
import type { Character, Parameter, Power, Stage } from "../models";
import { resolveChoice } from "./turn";
import { beginTurn } from "./selection";
import { createSession } from "./session";
import { createSeededRng } from "./rng";
import {
  makeCard,
  makeContent,
  makeEngineContext,
  makeOption,
  makeSession,
  makeStage,
} from "./testing";

const T0 = "2026-01-01T00:00:00.000Z";
const stats = {};

function param(id: string, overrides: Partial<Parameter> = {}): Parameter {
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
    initialValue: 50,
    thresholds: [],
    ...overrides,
  };
}

function char(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id,
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: id,
    name: { default: id },
    themeTags: [],
    unlockedByDefault: false,
    ...overrides,
  };
}

function activeSessionWith(cardId: string, overrides: Parameters<typeof makeSession>[0] = {}) {
  return makeSession({ currentCardId: cardId, ...overrides });
}

describe("resolveChoice — validación", () => {
  it("sesión no activa → throw", () => {
    expect(() =>
      resolveChoice(
        makeContent(),
        makeSession({ status: "lost" }),
        { optionId: "o1", shownAt: T0 },
        makeEngineContext(),
      ),
    ).toThrow();
  });

  it("sin carta actual → throw", () => {
    expect(() =>
      resolveChoice(
        makeContent(),
        makeSession(),
        { optionId: "o1", shownAt: T0 },
        makeEngineContext(),
      ),
    ).toThrow(/no tiene carta actual/);
  });

  it("opción inexistente → throw", () => {
    const card = makeCard({ id: "c1" });
    expect(() =>
      resolveChoice(
        makeContent({ cards: [card] }),
        activeSessionWith("c1"),
        { optionId: "o9", shownAt: T0 },
        makeEngineContext(),
      ),
    ).toThrow(/no existe/);
  });

  it("opción locked → throw", () => {
    const card = makeCard({
      id: "c1",
      options: [
        makeOption({ id: "o1" }),
        makeOption({
          id: "o2",
          order: 2,
          availability: { type: "has_flag", flag: "x" },
          whenUnavailable: "show_locked",
        }),
      ],
    });
    expect(() =>
      resolveChoice(
        makeContent({ cards: [card] }),
        activeSessionWith("c1"),
        { optionId: "o2", shownAt: T0 },
        makeEngineContext(),
      ),
    ).toThrow(/no está disponible/);
  });
});

describe("resolveChoice — ciclo completo", () => {
  it("aplica efectos, actualiza historial, suma turno y limpia currentCardId", () => {
    const card = makeCard({
      id: "c1",
      options: [
        makeOption({
          id: "o1",
          effects: [
            { type: "modify_parameter", parameterId: "p1", delta: -10 },
            { type: "add_score", points: 2 },
          ],
        }),
      ],
    });
    const content = makeContent({ cards: [card], parameters: [param("p1")] });
    const session = activeSessionWith("c1", {
      turn: 3,
      parameters: { p1: 50 },
      activeParameterIds: ["p1"],
    });
    const { session: s2, events, impression, chosenOption } = resolveChoice(
      content,
      session,
      { optionId: "o1", shownAt: T0, responseTimeMs: 1500 },
      makeEngineContext(),
    );
    expect(s2.parameters["p1"]).toBe(40);
    expect(s2.score).toBe(2);
    expect(s2.turn).toBe(4);
    expect(s2.currentCardId).toBeUndefined();
    expect(s2.cardHistory["c1"]).toEqual({ count: 1, lastTurn: 3, lastOptionId: "o1" });
    expect(events.map((e) => e.type)).toEqual(["parameter_changed", "score_changed"]);
    expect(chosenOption.id).toBe("o1");
    expect(impression.cardId).toBe("c1");
    expect(impression.turn).toBe(3);
    expect(impression.chosenOptionId).toBe("o1");
    expect(impression.responseTimeMs).toBe(1500);
    expect(impression.parametersBefore["p1"]).toBe(50);
    expect(impression.parametersAfter?.["p1"]).toBe(40);
    expect(impression.availableOptionIds).toEqual(["o1"]);
    expect(impression.causedGameOver).toBe(false);
    // inmutable
    expect(session.parameters["p1"]).toBe(50);
    expect(session.turn).toBe(3);
  });

  it("derrota por threshold tras los efectos", () => {
    const card = makeCard({
      id: "c1",
      options: [
        makeOption({
          id: "o1",
          effects: [{ type: "modify_parameter", parameterId: "p1", delta: -60 }],
        }),
      ],
    });
    const content = makeContent({
      cards: [card],
      parameters: [
        param("p1", {
          thresholds: [
            {
              id: "t1",
              comparator: "lte",
              value: 0,
              effects: [{ type: "end_game", outcome: "defeat", endingKey: "sin_p1" }],
            },
          ],
        }),
      ],
    });
    const session = activeSessionWith("c1", {
      parameters: { p1: 30 },
      activeParameterIds: ["p1"],
    });
    const { session: s2, events, impression } = resolveChoice(
      content,
      session,
      { optionId: "o1", shownAt: T0 },
      makeEngineContext(),
    );
    expect(s2.status).toBe("lost");
    expect(s2.endingKey).toBe("sin_p1");
    expect(events.map((e) => e.type)).toContain("threshold_fired");
    expect(events.map((e) => e.type)).toContain("game_ended");
    expect(impression.causedGameOver).toBe(true);
    // la carta igual queda en el historial
    expect(s2.cardHistory["c1"]?.count).toBe(1);
  });

  it("shield evita la derrota por threshold y queda en la impression", () => {
    const shield: Power = {
      id: "pw1",
      gameId: "off_game_test",
      schemaVersion: 1,
      createdAt: T0,
      updatedAt: T0,
      key: "pw1",
      name: { default: "Guardia" },
      kind: "shield",
      blocksThreatTags: ["internal_threat"],
    } as Power;
    const card = makeCard({
      id: "c1",
      options: [
        makeOption({
          id: "o1",
          threatTags: ["internal_threat"],
          effects: [{ type: "modify_parameter", parameterId: "p1", delta: -60 }],
        }),
      ],
    });
    const content = makeContent({
      cards: [card],
      powers: [shield],
      parameters: [
        param("p1", {
          thresholds: [
            {
              id: "t1",
              comparator: "lte",
              value: 0,
              effects: [{ type: "end_game", outcome: "defeat", endingKey: "fin" }],
            },
          ],
        }),
      ],
    });
    const session = activeSessionWith("c1", {
      parameters: { p1: 30 },
      activeParameterIds: ["p1"],
      powers: [{ powerId: "pw1", charges: 1 }],
    });
    const { session: s2, impression } = resolveChoice(
      content,
      session,
      { optionId: "o1", shownAt: T0 },
      makeEngineContext(),
    );
    expect(s2.status).toBe("active");
    expect(s2.powers).toHaveLength(0); // carga consumida
    expect(s2.parameters["p1"]).toBe(10); // reposicionado
    expect(impression.shieldUsedPowerId).toBe("pw1");
  });

  it("desbloquea personajes por unlockCondition tras los efectos", () => {
    const card = makeCard({
      id: "c1",
      options: [
        makeOption({
          id: "o1",
          effects: [{ type: "set_flag", flag: "met_general", value: true }],
        }),
      ],
    });
    const content = makeContent({
      cards: [card],
      characters: [
        char("general", {
          unlockCondition: { type: "has_flag", flag: "met_general" },
        }),
      ],
    });
    const { session: s2, events } = resolveChoice(
      content,
      activeSessionWith("c1"),
      { optionId: "o1", shownAt: T0 },
      makeEngineContext(),
    );
    expect(s2.unlockedCharacterIds).toContain("general");
    expect(events).toContainEqual({ type: "character_unlocked", characterId: "general" });
  });

  it("avanza de etapa: activa parámetros, corre onEnter y emite stage_advanced", () => {
    const stage2: Stage = makeStage({
      id: "off_stage_2",
      order: 2,
      minScore: 5,
      activatesParameterIds: ["p2"],
      onEnter: [{ type: "add_score", points: 1 }],
      difficultyRange: { min: 3, max: 7 },
    });
    const card = makeCard({
      id: "c1",
      options: [makeOption({ id: "o1", effects: [{ type: "add_score", points: 5 }] })],
    });
    const content = makeContent({
      cards: [card],
      parameters: [param("p1"), param("p2")],
      stages: [
        makeStage({ id: "off_stage_1", order: 1, difficultyRange: { min: 1, max: 4 } }),
        stage2,
      ],
    });
    const session = activeSessionWith("c1", {
      stageId: "off_stage_1",
      parameters: { p1: 50, p2: 50 },
      activeParameterIds: ["p1"],
    });
    const { session: s2, events } = resolveChoice(
      content,
      session,
      { optionId: "o1", shownAt: T0 },
      makeEngineContext(),
    );
    expect(s2.stageId).toBe("off_stage_2");
    expect(s2.activeParameterIds).toEqual(["p1", "p2"]);
    expect(s2.score).toBe(6); // 5 de la opción + 1 del onEnter
    expect(events).toContainEqual({ type: "stage_advanced", stageId: "off_stage_2" });
  });

  it("máximo una etapa por turno", () => {
    const card = makeCard({
      id: "c1",
      options: [makeOption({ id: "o1", effects: [{ type: "add_score", points: 100 }] })],
    });
    const content = makeContent({
      cards: [card],
      stages: [
        makeStage({ id: "s1", order: 1 }),
        makeStage({ id: "s2", order: 2, minScore: 1 }),
        makeStage({ id: "s3", order: 3, minScore: 1 }),
      ],
    });
    const session = activeSessionWith("c1", { stageId: "s1" });
    const { session: s2 } = resolveChoice(
      content,
      session,
      { optionId: "o1", shownAt: T0 },
      makeEngineContext(),
    );
    expect(s2.stageId).toBe("s2"); // no llega a s3 en el mismo turno
  });
});

describe("determinismo", () => {
  it("mismo seed + mismas elecciones → misma secuencia de cartas", () => {
    const cards = Array.from({ length: 8 }, (_, i) =>
      makeCard({
        id: `c${i}`,
        options: [makeOption({ id: "o1", effects: [{ type: "add_score", points: 1 }] })],
      }),
    );
    const content = makeContent({ cards });

    function playout(seed: number): string[] {
      let seq = 0;
      const ec2 = {
        rng: createSeededRng(seed),
        now: () => T0,
        newId: () => `id_${++seq}`,
      };
      const seen: string[] = [];
      let s = createSession(content, { userId: "u", locale: "es" }, ec2);
      for (let i = 0; i < 12 && s.status === "active"; i++) {
        const begun = beginTurn(content, s, stats, ec2);
        s = begun.session;
        if (!begun.card) break;
        seen.push(begun.card.id);
        const resolved = resolveChoice(
          content,
          s,
          { optionId: "o1", shownAt: T0 },
          ec2,
        );
        s = resolved.session;
      }
      return seen;
    }

    const a = playout(123);
    const b = playout(123);
    const c = playout(999);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(3);
    expect(a).not.toEqual(c);
  });
});
