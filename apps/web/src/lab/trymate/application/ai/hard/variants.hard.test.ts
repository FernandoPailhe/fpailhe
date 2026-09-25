import { describe, expect, it } from "vitest";
import { runArenaAsync } from "../arena";
import { hardFactory, mediumFactory } from "../testing/hardTestBot";
import { RULE_VARIANTS } from "../testing/ruleVariants";

const ARENA = process.env.TRYMATE_ARENA === "1";

describe("Hard — variantes de reglas", () => {
  for (const v of RULE_VARIANTS) {
    it(`CI [${v.name}]: 4 partidas vs Medium, 0 acciones ilegales`, async () => {
      const r = await runArenaAsync(hardFactory(), mediumFactory, v, 4, 31_337);
      console.warn(
        `[variants-hard] ${v.name}: ${r.aWins}–${r.bWins}–${r.draws}, ilegales=${r.illegal}` +
          (r.firstIllegalAction ? ` (${r.firstIllegalAction})` : ""),
      );
      expect(r.illegal).toBe(0);
    }, 300_000);

    it.skipIf(!ARENA)(
      `arena larga [${v.name}]: Hard ≥6 de 10 vs Medium`,
      async () => {
        const r = await runArenaAsync(hardFactory(), mediumFactory, v, 10, 97_531);
        console.warn(
          `[variants-hard] ${v.name} 10: ${r.aWins}–${r.bWins}–${r.draws}, ilegales=${r.illegal}`,
        );
        expect(r.illegal).toBe(0);
        expect(r.aWins).toBeGreaterThanOrEqual(6);
      },
      1_800_000,
    );
  }
});
