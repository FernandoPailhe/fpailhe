import { describe, expect, it } from "vitest";
import type { CardStats } from "../models";
import { computeEffectiveWeight, toCardStats } from "./weights";
import { makeCard } from "./testing";

const card = makeCard({ difficulty: 5, baseWeight: 10 });

function stats(overrides: Partial<CardStats> = {}): CardStats {
  return {
    cardId: card.id,
    gameId: card.gameId,
    impressions: 0,
    optionChoiceCounts: {},
    positiveVotes: 0,
    negativeVotes: 0,
    gameOverCount: 0,
    avgResponseTimeMs: 0,
    lossRateAfter: 0,
    observedDifficulty: 5,
    effectiveWeight: 0,
    needsReview: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeEffectiveWeight", () => {
  it("sin stats o con pocas impresiones → baseWeight", () => {
    expect(computeEffectiveWeight(card, undefined)).toBe(10);
    expect(computeEffectiveWeight(card, stats({ impressions: 19 }))).toBe(10);
  });

  it("más votos positivos → mayor peso", () => {
    const liked = stats({ impressions: 30, positiveVotes: 20, negativeVotes: 0 });
    const disliked = stats({ impressions: 30, positiveVotes: 0, negativeVotes: 20 });
    expect(computeEffectiveWeight(card, liked)).toBeGreaterThan(card.baseWeight);
    expect(computeEffectiveWeight(card, disliked)).toBeLessThan(card.baseWeight);
  });

  it("dificultad observada lejos de la declarada → menor peso", () => {
    const fit = stats({ impressions: 30, observedDifficulty: 5 });
    const off = stats({ impressions: 30, observedDifficulty: 10 });
    expect(computeEffectiveWeight(card, off)).toBeLessThan(computeEffectiveWeight(card, fit));
  });

  it("acota el feedbackFactor a [0.2, 2.0]", () => {
    const extreme = stats({ impressions: 100, positiveVotes: 10000, negativeVotes: 0 });
    expect(computeEffectiveWeight(card, extreme)).toBeLessThanOrEqual(card.baseWeight * 2);
    const hated = stats({ impressions: 100, positiveVotes: 0, negativeVotes: 10000 });
    expect(computeEffectiveWeight(card, hated)).toBeGreaterThanOrEqual(card.baseWeight * 0.2 * 0.5);
  });
});

describe("toCardStats", () => {
  it("deriva promedios y dificultad observada", () => {
    const s = toCardStats(
      card,
      {
        impressions: 10,
        optionChoiceCounts: { o1: 7, o2: 3 },
        positiveVotes: 4,
        negativeVotes: 1,
        gameOverCount: 5,
        responseTimeTotalMs: 20000,
      },
      "2026-02-01T00:00:00.000Z",
    );
    expect(s.avgResponseTimeMs).toBe(2000);
    expect(s.lossRateAfter).toBe(0.5);
    // observedDifficulty = clamp(round(1 + 9·min(1, 3·0.5)), 1, 10) = clamp(round(14.5)) → 10
    expect(s.observedDifficulty).toBe(10);
    expect(s.updatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(s.needsReview).toBe(false);
    expect(s.effectiveWeight).toBe(card.baseWeight); // < MIN_IMPRESSIONS_FOR_WEIGHT? no: 10 < 20 → base
  });

  it("needsReview en el borde: ≥10 votos y >60% negativos", () => {
    const borderline = toCardStats(
      card,
      { impressions: 0, optionChoiceCounts: {}, positiveVotes: 4, negativeVotes: 6, gameOverCount: 0, responseTimeTotalMs: 0 },
      "t",
    );
    expect(borderline.needsReview).toBe(false); // 6/10 = 0.6 no es > 0.6
    const flagged = toCardStats(
      card,
      { impressions: 0, optionChoiceCounts: {}, positiveVotes: 3, negativeVotes: 7, gameOverCount: 0, responseTimeTotalMs: 0 },
      "t",
    );
    expect(flagged.needsReview).toBe(true);
    const few = toCardStats(
      card,
      { impressions: 0, optionChoiceCounts: {}, positiveVotes: 0, negativeVotes: 9, gameOverCount: 0, responseTimeTotalMs: 0 },
      "t",
    );
    expect(few.needsReview).toBe(false); // solo 9 votos
  });
});
