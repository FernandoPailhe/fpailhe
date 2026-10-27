import { describe, expect, it } from "vitest";
import type { Parameter, ParameterThreshold, Power } from "../models";
import { settleThresholds } from "./thresholds";
import { makeContent, makeEngineContext, makeSession } from "./testing";

const T0 = "2026-01-01T00:00:00.000Z";
const ec = makeEngineContext();

function thr(overrides: Partial<ParameterThreshold> = {}): ParameterThreshold {
  return {
    id: "thr1",
    comparator: "lte",
    value: 0,
    effects: [{ type: "end_game", outcome: "defeat", endingKey: "fin" }],
    ...overrides,
  };
}

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
    thresholds: [thr()],
    ...overrides,
  };
}

function shield(id = "pw1", tags = ["fire"]): Power {
  return {
    id,
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: id,
    name: { default: id },
    kind: "shield",
    blocksThreatTags: tags,
  } as Power;
}

function activeSession(value: number, overrides: Parameters<typeof makeSession>[0] = {}) {
  return makeSession({
    parameters: { p1: value },
    activeParameterIds: ["p1"],
    ...overrides,
  });
}

describe("settleThresholds — disparo", () => {
  it("lte 0 sin shield → derrota con endingKey", () => {
    const content = makeContent({ parameters: [param()] });
    const { session: s2, events } = settleThresholds(content, activeSession(0), ec);
    expect(s2.status).toBe("lost");
    expect(s2.endingKey).toBe("fin");
    expect(events).toContainEqual({
      type: "threshold_fired",
      parameterId: "p1",
      thresholdId: "thr1",
    });
    expect(events).toContainEqual({ type: "game_ended", outcome: "defeat", endingKey: "fin" });
  });

  it("valor por encima del threshold no dispara", () => {
    const content = makeContent({ parameters: [param()] });
    const { session: s2, events } = settleThresholds(content, activeSession(10), ec);
    expect(s2.status).toBe("active");
    expect(events).toHaveLength(0);
  });

  it("threshold once se marca y no repite en llamadas siguientes", () => {
    const content = makeContent({
      parameters: [
        param({
          thresholds: [
            thr({ id: "t1", comparator: "lte", value: 60, once: true, effects: [{ type: "add_score", points: 1 }] }),
          ],
        }),
      ],
    });
    const { session: s1 } = settleThresholds(content, activeSession(50), ec);
    expect(s1.firedThresholdIds).toEqual(["t1"]);
    const { session: s2, events } = settleThresholds(content, s1, ec);
    expect(events).toHaveLength(0);
    expect(s2.firedThresholdIds).toEqual(["t1"]);
  });

  it("threshold sin once no se dispara dos veces en la misma llamada", () => {
    const content = makeContent({
      parameters: [
        param({
          thresholds: [
            thr({ id: "t1", comparator: "lte", value: 60, effects: [{ type: "add_score", points: 1 }] }),
          ],
        }),
      ],
    });
    const { events } = settleThresholds(content, activeSession(50), ec);
    expect(events.filter((e) => e.type === "threshold_fired")).toHaveLength(1);
    expect(events.filter((e) => e.type === "score_changed")).toHaveLength(1);
  });

  it("parámetro inactivo no dispara aunque cumpla el threshold", () => {
    const content = makeContent({ parameters: [param()] });
    const session = makeSession({ parameters: { p1: 0 }, activeParameterIds: [] });
    const { session: s2, events } = settleThresholds(content, session, ec);
    expect(s2.status).toBe("active");
    expect(events).toHaveLength(0);
  });
});

describe("settleThresholds — shields", () => {
  it("absorbe: consume 1 carga, sin derrota y reposiciona el parámetro", () => {
    const content = makeContent({
      parameters: [param({ thresholds: [thr({ threatTags: ["fire"] })] })],
      powers: [shield()],
    });
    const session = activeSession(0, { powers: [{ powerId: "pw1", charges: 2 }] });
    const { session: s2, events } = settleThresholds(content, session, ec);
    expect(s2.status).toBe("active");
    expect(s2.powers).toEqual([{ powerId: "pw1", charges: 1 }]);
    // lte → threshold.value + round(0.1 × (max − min)) = 0 + 10
    expect(s2.parameters["p1"]).toBe(10);
    expect(events).toContainEqual({ type: "shield_used", powerId: "pw1", parameterId: "p1" });
    expect(s2.firedThresholdIds).toHaveLength(0);
    expect(events.filter((e) => e.type === "threshold_fired")).toHaveLength(0);
  });

  it("gte se reposiciona hacia abajo", () => {
    const content = makeContent({
      parameters: [
        param({ thresholds: [thr({ comparator: "gte", value: 100, threatTags: ["fire"] })] }),
      ],
      powers: [shield()],
    });
    const session = activeSession(100, { powers: [{ powerId: "pw1", charges: 1 }] });
    const { session: s2 } = settleThresholds(content, session, ec);
    expect(s2.status).toBe("active");
    expect(s2.parameters["p1"]).toBe(90); // 100 − 10
  });

  it("los threatTags de la opción también alimentan el threshold (regla 4)", () => {
    const content = makeContent({
      parameters: [param({ thresholds: [thr()] })], // sin tags propios
      powers: [shield()],
    });
    const session = activeSession(0, { powers: [{ powerId: "pw1", charges: 1 }] });
    const { session: s2 } = settleThresholds(content, session, ec, { threatTags: ["fire"] });
    expect(s2.status).toBe("active");
    expect(s2.parameters["p1"]).toBe(10);
  });

  it("el threshold absorbido no vuelve a disparar en la siguiente llamada", () => {
    const content = makeContent({
      parameters: [param({ thresholds: [thr({ threatTags: ["fire"] })] })],
      powers: [shield()],
    });
    const session = activeSession(0, { powers: [{ powerId: "pw1", charges: 1 }] });
    const { session: s1 } = settleThresholds(content, session, ec);
    const { session: s2, events } = settleThresholds(content, s1, ec);
    expect(s2.status).toBe("active");
    expect(events).toHaveLength(0);
  });
});

describe("settleThresholds — cascada", () => {
  it("los efectos de un threshold pueden disparar otros", () => {
    const content = makeContent({
      parameters: [
        param({
          id: "p1",
          thresholds: [
            thr({ id: "t1", comparator: "lte", value: 60, effects: [{ type: "set_parameter", parameterId: "p2", value: 0 }] }),
          ],
        }),
        param({
          id: "p2",
          thresholds: [thr({ id: "t2", comparator: "lte", value: 0 })],
        }),
      ],
    });
    const session = makeSession({
      parameters: { p1: 50, p2: 80 },
      activeParameterIds: ["p1", "p2"],
    });
    const { session: s2, events } = settleThresholds(content, session, ec);
    expect(s2.status).toBe("lost");
    expect(events).toContainEqual({ type: "threshold_fired", parameterId: "p1", thresholdId: "t1" });
    expect(events).toContainEqual({ type: "threshold_fired", parameterId: "p2", thresholdId: "t2" });
  });

  it("superar el tope emite cascade_limit_reached y el juego sigue", () => {
    // Cadena de 10 parámetros: cada threshold baja al parámetro ANTERIOR del
    // array, así cada ronda solo dispara un threshold nuevo → 10 rondas.
    const params = Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return param({
        id: `b${n}`,
        thresholds: [
          thr({
            id: `t${n}`,
            comparator: "lte",
            value: 90,
            effects:
              n >= 2
                ? [{ type: "set_parameter", parameterId: `b${n - 1}`, value: 0 }]
                : [{ type: "add_score", points: 1 }],
          }),
        ],
      });
    });
    const content = makeContent({ parameters: params });
    const session = makeSession({
      parameters: { b1: 95, b2: 95, b3: 95, b4: 95, b5: 95, b6: 95, b7: 95, b8: 95, b9: 95, b10: 0 },
      activeParameterIds: params.map((p) => p.id),
    });
    const { session: s2, events } = settleThresholds(content, session, ec);
    expect(s2.status).toBe("active");
    expect(events.filter((e) => e.type === "threshold_fired")).toHaveLength(10);
    expect(events).toContainEqual({ type: "cascade_limit_reached" });
  });
});
