import { describe, expect, it } from "vitest";
import { CURRENT_RULES } from "../../domain/config/RulesView";
import { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { runArena } from "./arena";
import { createEasyBot } from "./EasyBot";
import { createMediumBot } from "./MediumBot";
import type { RuleVariant } from "./testing/ruleVariants";

const current: RuleVariant = {
  name: "current",
  rules: CURRENT_RULES,
  engine: new MovementRuleEngine(),
};

const longRun = process.env.TRYMATE_ARENA === "1";

/**
 * Calidad del Medium contra Easy con las reglas actuales. La versión corta
 * corre siempre; la larga (40 partidas, umbral 75 %) detrás de TRYMATE_ARENA=1.
 */
describe("arena Medium vs Easy (reglas actuales)", { timeout: 120_000 }, () => {
  it("10 partidas: gana ≥ 7 y 0 acciones ilegales", () => {
    const summary = runArena(createMediumBot, createEasyBot, current, 10, 500);
    expect(summary.illegal).toBe(0);
    expect(summary.firstIllegalAction).toBeUndefined();
    expect(summary.aWins).toBeGreaterThanOrEqual(7);
  });

  it.skipIf(!longRun)("40 partidas: gana ≥ 30 (75 %)", { timeout: 600_000 }, () => {
    const summary = runArena(createMediumBot, createEasyBot, current, 40, 1000);
    expect(summary.illegal).toBe(0);
    expect(summary.aWins).toBeGreaterThanOrEqual(30);
  });
});
