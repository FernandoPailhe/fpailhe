import { describe, expect, it } from "vitest";
import { CURRENT_RULES } from "../../../domain/config/RulesView";
import { buildRulesView } from "../../../domain/config/RulesView";
import { GAME_RULES } from "../../../domain/constants/GameRules";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { playArenaGame } from "../arena";
import type { ComputerPlayer } from "../ComputerPlayer";
import { createEasyBot } from "../EasyBot";
import { createMediumBot } from "../MediumBot";
import { createSeededRng } from "../rng";
import type { RuleVariant } from "../testing/ruleVariants";

const current: RuleVariant = {
  name: "current",
  rules: CURRENT_RULES,
  engine: new MovementRuleEngine(),
};
const wide: RuleVariant = {
  name: "wide-7x13",
  rules: buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES),
  engine: new MovementRuleEngine(),
};

/** Medium envuelto: cronometra cada choosePlayAction (hasta `limit`). */
const timedMedium = (timings: number[], limit = 20): ComputerPlayer => {
  const bot = createMediumBot(createSeededRng(9));
  return {
    difficulty: "medium",
    chooseSetupPlacement: (ctx) => bot.chooseSetupPlacement(ctx),
    chooseBenchType: (ctx) => bot.chooseBenchType(ctx),
    choosePlayAction: (ctx) => {
      if (timings.length >= limit) return bot.choosePlayAction(ctx);
      const t0 = performance.now();
      const action = bot.choosePlayAction(ctx);
      timings.push(performance.now() - t0);
      return action;
    },
  };
};

const p95 = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
};

describe("Medium — rendimiento", { timeout: 120_000 }, () => {
  it("p95 de choosePlayAction < 400 ms (objetivo local < 150 ms)", () => {
    const timings: number[] = [];
    const result = playArenaGame(
      timedMedium(timings),
      createEasyBot(createSeededRng(8)),
      current,
      21,
      300,
    );
    expect(result.illegalAction).toBeUndefined();
    expect(timings.length).toBeGreaterThan(0);
    const value = p95(timings);
    console.log(
      `[perf] Medium current: ${timings.length} decisiones, p95 = ${value.toFixed(1)} ms (max ${Math.max(...timings).toFixed(1)} ms)`,
    );
    expect(value).toBeLessThan(400);
  });

  it("wide-7x13: solo log del p95 (sin assert)", () => {
    const timings: number[] = [];
    const result = playArenaGame(
      timedMedium(timings),
      createEasyBot(createSeededRng(8)),
      wide,
      22,
      300,
    );
    expect(result.illegalAction).toBeUndefined();
    if (timings.length > 0) {
      console.log(
        `[perf] Medium wide-7x13: ${timings.length} decisiones, p95 = ${p95(timings).toFixed(1)} ms`,
      );
    }
  });
});
