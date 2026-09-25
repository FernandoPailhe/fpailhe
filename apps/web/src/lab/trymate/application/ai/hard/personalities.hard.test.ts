import { describe, expect, it } from "vitest";
import { runArenaAsync, type SideMetrics } from "../arena";
import { hardFactory, mediumFactory } from "../testing/hardTestBot";
import { RULE_VARIANTS } from "../testing/ruleVariants";
import type { Personality } from "../personality";

const ARENA = process.env.TRYMATE_ARENA === "1";
const current = RULE_VARIANTS[0]!;
const PERSONALITIES: Personality[] = ["balanced", "offensive", "defensive"];

const avgFront = (m: SideMetrics): number =>
  m.frontTurns > 0 ? m.frontProgressSum / m.frontTurns : 0;

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Métricas medias de una personalidad vs Medium sobre N partidas. */
async function styleRun(p: Personality, games: number, seed: number) {
  const r = await runArenaAsync(hardFactory(p), mediumFactory, current, games, seed);
  const m = r.perGame.map((g) => g.a);
  return {
    wins: r.aWins,
    illegal: r.illegal,
    avgFrontProgress: mean(m.map(avgFront)),
    pliesToFirstScore: mean(m.map((x) => x.pliesToFirstScore ?? 999)),
    capturesMade: mean(m.map((x) => x.capturesMade)),
    piecesLost: mean(m.map((x) => x.piecesLost)),
    opponentMaxProgress: mean(m.map((x) => x.opponentMaxProgress)),
    endedByBlock: m.filter((x) => x.endedByBlock).length,
  };
}

describe("Hard — personalidades", () => {
  for (const p of PERSONALITIES) {
    it(`CI: ${p} gana ≥6 de 10 vs Medium`, async () => {
      const r = await runArenaAsync(hardFactory(p), mediumFactory, current, 10, 4_321);
      console.warn(
        `[pers-hard] ${p} vs Medium 10: ${r.aWins}–${r.bWins}–${r.draws}, ilegales=${r.illegal}`,
      );
      expect(r.illegal).toBe(0);
      expect(r.aWins).toBeGreaterThanOrEqual(6);
    }, 300_000);

    it.skipIf(!ARENA)(
      `paridad: ${p} vs balanced queda entre 40–60% en 40 partidas`,
      async () => {
        if (p === "balanced") return;
        const r = await runArenaAsync(hardFactory(p), hardFactory("balanced"), current, 40, 8_989);
        const rate = r.aWins / 40;
        console.warn(
          `[pers-hard] paridad ${p} vs balanced: ${r.aWins}–${r.bWins}–${r.draws} ` +
            `(${Math.round(rate * 100)}%), ilegales=${r.illegal}`,
        );
        expect(r.illegal).toBe(0);
        expect(rate).toBeGreaterThanOrEqual(0.4);
        expect(rate).toBeLessThanOrEqual(0.6);
      },
      1_800_000,
    );
  }

  it.skipIf(!ARENA)(
    "estilo: offensive avanza más y anota antes; defensive contiene mejor",
    async () => {
      const seed = 6_789;
      const off = await styleRun("offensive", 20, seed);
      const bal = await styleRun("balanced", 20, seed);
      const def = await styleRun("defensive", 20, seed);
      console.warn(
        "[pers-hard] estilo vs Medium (20 partidas):\n" +
          ["offensive", "balanced", "defensive"]
            .map((n, i) => {
              const s = [off, bal, def][i]!;
              return (
                `  ${n}: front=${s.avgFrontProgress.toFixed(2)} ` +
                `firstScore=${s.pliesToFirstScore.toFixed(1)} ` +
                `oppMax=${s.opponentMaxProgress.toFixed(2)} ` +
                `lost=${s.piecesLost.toFixed(2)} wins=${s.wins}`
              );
            })
            .join("\n"),
      );
      expect(off.illegal + bal.illegal + def.illegal).toBe(0);
      expect(off.avgFrontProgress).toBeGreaterThan(bal.avgFrontProgress);
      expect(bal.avgFrontProgress).toBeGreaterThan(def.avgFrontProgress);
      expect(off.pliesToFirstScore).toBeLessThan(def.pliesToFirstScore);
      expect(def.opponentMaxProgress).toBeLessThan(off.opponentMaxProgress);
      expect(def.piecesLost).toBeLessThanOrEqual(off.piecesLost);
    },
    1_800_000,
  );
});
