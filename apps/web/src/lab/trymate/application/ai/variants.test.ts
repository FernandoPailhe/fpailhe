import { describe, expect, it } from "vitest";
import { createEasyBot } from "./EasyBot";
import { createMediumBot } from "./MediumBot";
import { runArena } from "./arena";
import { RULE_VARIANTS } from "./testing/ruleVariants";

const longRun = process.env.TRYMATE_ARENA === "1";

/**
 * La red de seguridad del agnosticismo: los bots juegan partidas completas y
 * solo legales bajo cada variante de reglas, sin depender del store ni de las
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

describe("arena Medium vs Easy por variante", { timeout: 180_000 }, () => {
  for (const variant of RULE_VARIANTS) {
    it(`${variant.name}: 4 partidas, 0 acciones ilegales`, () => {
      const summary = runArena(createMediumBot, createEasyBot, variant, 4, 300);
      expect(summary.illegal).toBe(0);
      expect(summary.firstIllegalAction).toBeUndefined();
    });
  }

  it.skipIf(!longRun)(
    "10 partidas por variante: Medium gana ≥ 6 (60 %)",
    { timeout: 600_000 },
    () => {
      for (const variant of RULE_VARIANTS) {
        const summary = runArena(createMediumBot, createEasyBot, variant, 10, 700);
        expect(summary.illegal).toBe(0);
        expect(summary.aWins, `[${variant.name}]`).toBeGreaterThanOrEqual(6);
      }
    },
  );
});
