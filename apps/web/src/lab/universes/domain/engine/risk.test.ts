import { describe, expect, it } from "vitest";
import type { Parameter, ParameterThreshold } from "../models";
import { getThresholdRisk } from "./risk";

const T0 = "2026-01-01T00:00:00.000Z";

function thr(overrides: Partial<ParameterThreshold>): ParameterThreshold {
  return {
    id: "t",
    comparator: "lte",
    value: 0,
    effects: [],
    ...overrides,
  };
}

function param(overrides: Partial<Parameter>): Parameter {
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

const p = param({
  thresholds: [
    thr({ id: "lo", comparator: "lte", value: 0 }),
    thr({ id: "hi", comparator: "gte", value: 100 }),
  ],
});

describe("getThresholdRisk", () => {
  it("low cerca del extremo inferior", () => {
    expect(getThresholdRisk(p, 10)).toBe("low"); // 10 ≤ 0 + 15
    expect(getThresholdRisk(p, 0)).toBe("low");
  });

  it("high cerca del extremo superior", () => {
    expect(getThresholdRisk(p, 90)).toBe("high"); // 90 ≥ 100 − 15
    expect(getThresholdRisk(p, 100)).toBe("high");
  });

  it("null en zona segura", () => {
    expect(getThresholdRisk(p, 50)).toBeNull();
  });

  it("el más cercano gana cuando ambos cumplen", () => {
    const narrow = param({
      min: 0,
      max: 20,
      thresholds: [
        thr({ id: "lo", comparator: "lte", value: 0 }),
        thr({ id: "hi", comparator: "gte", value: 20 }),
      ],
    });
    expect(getThresholdRisk(narrow, 3)).toBe("low");
    expect(getThresholdRisk(narrow, 18)).toBe("high");
  });

  it("respeta un ratio custom", () => {
    expect(getThresholdRisk(p, 20, 0.1)).toBeNull();
    expect(getThresholdRisk(p, 20, 0.25)).toBe("low");
  });

  it("ignora thresholds fuera de [min, max]", () => {
    const weird = param({
      thresholds: [thr({ id: "x", comparator: "lte", value: -50 })],
    });
    expect(getThresholdRisk(weird, 0)).toBeNull();
  });
});
