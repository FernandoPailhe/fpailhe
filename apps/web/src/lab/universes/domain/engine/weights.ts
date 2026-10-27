import type { CardStats, ISODate, SituationCard } from "../models";
import { ENGINE_CONFIG } from "./config";
import type { RawCardCounters } from "./types";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Regla 14: peso efectivo del sorteo. Sin stats suficientes → `baseWeight`;
 * si no, `baseWeight × feedbackFactor × difficultyFitFactor`.
 */
export function computeEffectiveWeight(card: SituationCard, stats: CardStats | undefined): number {
  if (!stats || stats.impressions < ENGINE_CONFIG.MIN_IMPRESSIONS_FOR_WEIGHT) {
    return card.baseWeight;
  }
  const pos = stats.positiveVotes;
  const neg = stats.negativeVotes;
  const feedbackFactor = clamp(
    (2 * (pos + 1)) / (pos + neg + 2),
    ENGINE_CONFIG.FEEDBACK_FACTOR_MIN,
    ENGINE_CONFIG.FEEDBACK_FACTOR_MAX,
  );
  const difficultyFitFactor =
    1 - Math.min(0.5, Math.abs(stats.observedDifficulty - card.difficulty) / 10);
  return card.baseWeight * feedbackFactor * difficultyFitFactor;
}

/** Deriva el `CardStats` completo desde contadores crudos (regla 14). */
export function toCardStats(
  card: SituationCard,
  raw: RawCardCounters,
  now: ISODate,
): CardStats {
  const { impressions } = raw;
  const avgResponseTimeMs = impressions ? raw.responseTimeTotalMs / impressions : 0;
  const lossRateAfter = impressions ? raw.gameOverCount / impressions : 0;
  const observedDifficulty = clamp(
    Math.round(1 + 9 * Math.min(1, 3 * lossRateAfter)),
    1,
    10,
  );
  const totalVotes = raw.positiveVotes + raw.negativeVotes;
  const needsReview =
    totalVotes >= ENGINE_CONFIG.NEEDS_REVIEW_MIN_VOTES &&
    raw.negativeVotes / totalVotes > ENGINE_CONFIG.NEEDS_REVIEW_NEGATIVE_RATIO;

  const partial: CardStats = {
    cardId: card.id,
    gameId: card.gameId,
    impressions,
    optionChoiceCounts: { ...raw.optionChoiceCounts },
    positiveVotes: raw.positiveVotes,
    negativeVotes: raw.negativeVotes,
    gameOverCount: raw.gameOverCount,
    avgResponseTimeMs,
    lossRateAfter,
    observedDifficulty,
    effectiveWeight: card.baseWeight,
    needsReview,
    updatedAt: now,
  };
  return { ...partial, effectiveWeight: computeEffectiveWeight(card, partial) };
}
