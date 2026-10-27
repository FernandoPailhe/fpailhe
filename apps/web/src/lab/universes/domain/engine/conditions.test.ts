import { describe, expect, it } from "vitest";
import { compare, evaluateCondition } from "./conditions";
import { makeContent, makeSession } from "./testing";

const content = makeContent();

function session(overrides: Parameters<typeof makeSession>[0] = {}) {
  return makeSession({
    parameters: { p1: 50 },
    activeParameterIds: ["p1"],
    branchIds: ["b1"],
    unlockedCharacterIds: ["c1"],
    powers: [{ powerId: "pw1", charges: 2 }],
    flags: { f1: "x", f2: 3 },
    cardHistory: { card1: { count: 1, lastTurn: 0, lastOptionId: "o1" } },
    score: 12,
    turn: 5,
    ...overrides,
  });
}

describe("compare", () => {
  it("cubre los 6 comparadores", () => {
    expect(compare(1, "lt", 2)).toBe(true);
    expect(compare(2, "lte", 2)).toBe(true);
    expect(compare(2, "eq", 2)).toBe(true);
    expect(compare(3, "gte", 2)).toBe(true);
    expect(compare(3, "gt", 2)).toBe(true);
    expect(compare(1, "neq", 2)).toBe(true);
  });
});

describe("evaluateCondition", () => {
  it("undefined → true", () => {
    expect(evaluateCondition(undefined, session(), content)).toBe(true);
  });

  it("all: todas verdaderas → true; una falsa → false; vacío → true", () => {
    expect(
      evaluateCondition(
        {
          type: "all",
          conditions: [
            { type: "score", comparator: "gte", value: 10 },
            { type: "in_branch", branchId: "b1" },
          ],
        },
        session(),
        content,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "all", conditions: [{ type: "in_branch", branchId: "zzz" }] },
        session(),
        content,
      ),
    ).toBe(false);
    expect(evaluateCondition({ type: "all", conditions: [] }, session(), content)).toBe(true);
  });

  it("any: alguna verdadera → true; vacío → false", () => {
    expect(
      evaluateCondition(
        {
          type: "any",
          conditions: [
            { type: "in_branch", branchId: "zzz" },
            { type: "in_branch", branchId: "b1" },
          ],
        },
        session(),
        content,
      ),
    ).toBe(true);
    expect(evaluateCondition({ type: "any", conditions: [] }, session(), content)).toBe(false);
  });

  it("not invierte", () => {
    expect(
      evaluateCondition(
        { type: "not", condition: { type: "in_branch", branchId: "zzz" } },
        session(),
        content,
      ),
    ).toBe(true);
  });

  it("parameter: compara el valor; ausente → false", () => {
    expect(
      evaluateCondition(
        { type: "parameter", parameterId: "p1", comparator: "gte", value: 50 },
        session(),
        content,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "parameter", parameterId: "p1", comparator: "lt", value: 50 },
        session(),
        content,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: "parameter", parameterId: "nope", comparator: "gte", value: 0 },
        session(),
        content,
      ),
    ).toBe(false);
  });

  it("score y turn comparan contra la sesión", () => {
    expect(
      evaluateCondition({ type: "score", comparator: "gte", value: 12 }, session(), content),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "turn", comparator: "eq", value: 5 }, session(), content),
    ).toBe(true);
  });

  it("stage_at_least usa el orden de la etapa actual", () => {
    expect(
      evaluateCondition({ type: "stage_at_least", stageOrder: 1 }, session(), content),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "stage_at_least", stageOrder: 2 }, session(), content),
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: "stage_at_least", stageOrder: 1 },
        session({ stageId: "desconocida" }),
        content,
      ),
    ).toBe(false);
  });

  it("in_branch / character_unlocked / has_power", () => {
    expect(
      evaluateCondition({ type: "in_branch", branchId: "b1" }, session(), content),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "in_branch", branchId: "b2" }, session(), content),
    ).toBe(false);
    expect(
      evaluateCondition({ type: "character_unlocked", characterId: "c1" }, session(), content),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "character_unlocked", characterId: "c2" }, session(), content),
    ).toBe(false);
    expect(
      evaluateCondition({ type: "has_power", powerId: "pw1" }, session(), content),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "has_power", powerId: "pw1", minCharges: 3 }, session(), content),
    ).toBe(false);
    expect(
      evaluateCondition({ type: "has_power", powerId: "pw2" }, session(), content),
    ).toBe(false);
  });

  it("has_flag: existe / igualdad estricta", () => {
    expect(evaluateCondition({ type: "has_flag", flag: "f1" }, session(), content)).toBe(true);
    expect(evaluateCondition({ type: "has_flag", flag: "f9" }, session(), content)).toBe(false);
    expect(
      evaluateCondition({ type: "has_flag", flag: "f2", value: 3 }, session(), content),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "has_flag", flag: "f2", value: "3" }, session(), content),
    ).toBe(false);
  });

  it("card_seen: por carta y por opción elegida", () => {
    expect(
      evaluateCondition({ type: "card_seen", cardId: "card1" }, session(), content),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "card_seen", cardId: "card9" }, session(), content),
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: "card_seen", cardId: "card1", optionId: "o1" },
        session(),
        content,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: "card_seen", cardId: "card1", optionId: "o2" },
        session(),
        content,
      ),
    ).toBe(false);
  });
});
