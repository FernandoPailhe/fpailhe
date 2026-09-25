import { describe, expect, it } from "vitest";
import { runArenaAsync } from "../arena";
import { easyFactory, hardFactory, mediumFactory } from "../testing/hardTestBot";
import { RULE_VARIANTS } from "../testing/ruleVariants";

const ARENA = process.env.TRYMATE_ARENA === "1";
const current = RULE_VARIANTS[0]!;

describe("arena Hard", () => {
  it("CI: Hard gana ≥7 de 10 vs Medium", async () => {
    const r = await runArenaAsync(hardFactory(), mediumFactory, current, 10, 1_234);
    console.warn(
      `[arena-hard] Hard vs Medium 10: ${r.aWins}–${r.bWins}–${r.draws}, ilegales=${r.illegal}`,
    );
    expect(r.illegal).toBe(0);
    expect(r.aWins).toBeGreaterThanOrEqual(7);
  }, 300_000);

  it.skipIf(!ARENA)(
    "arena larga: Hard ≥28/40 vs Medium",
    async () => {
      const r = await runArenaAsync(hardFactory(), mediumFactory, current, 40, 7_777);
      console.warn(
        `[arena-hard] Hard vs Medium 40: ${r.aWins}–${r.bWins}–${r.draws}, ilegales=${r.illegal}`,
      );
      expect(r.illegal).toBe(0);
      expect(r.aWins).toBeGreaterThanOrEqual(28);
    },
    1_800_000,
  );

  it.skipIf(!ARENA)(
    "arena larga: Hard ≥18/20 vs Easy",
    async () => {
      const r = await runArenaAsync(hardFactory(), easyFactory, current, 20, 5_555);
      console.warn(
        `[arena-hard] Hard vs Easy 20: ${r.aWins}–${r.bWins}–${r.draws}, ilegales=${r.illegal}`,
      );
      expect(r.illegal).toBe(0);
      expect(r.aWins).toBeGreaterThanOrEqual(18);
    },
    1_800_000,
  );
});
