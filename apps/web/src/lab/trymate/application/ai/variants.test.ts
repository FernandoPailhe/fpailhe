import { describe, expect, it } from "vitest";
import { createEasyBot } from "./EasyBot";
import { runArena } from "./arena";
import { RULE_VARIANTS } from "./testing/ruleVariants";

/**
 * La red de seguridad del agnosticismo: Easy juega partidas completas y solo
 * legales bajo cada variante de reglas, sin depender del store ni de las
 * constantes globales.
 */
describe("arena Easy vs Easy por variante", { timeout: 60_000 }, () => {
  for (const variant of RULE_VARIANTS) {
    it(`${variant.name}: 6 partidas, 0 acciones ilegales, ≥1 con ganador`, () => {
      const summary = runArena(createEasyBot, createEasyBot, variant, 6, 100);
      expect(summary.illegal).toBe(0);
      expect(summary.firstIllegalAction).toBeUndefined();
      expect(summary.aWins + summary.bWins).toBeGreaterThanOrEqual(1);
    });
  }
});
