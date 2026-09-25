import { describe, expect, it } from "vitest";
import { expandGames, parseExperiment } from "../core/experiment";

const ALL_BOTS = ["easy", "medium", "hard"];
const presets = Object.entries(
  import.meta.glob<string>("./*.json", { eager: true, query: "?raw", import: "default" }),
).sort(([a], [b]) => a.localeCompare(b));

describe("presets de experimentos", () => {
  it("hay presets y todos parsean y expanden exactamente `games` partidas", () => {
    expect(presets.length).toBeGreaterThanOrEqual(8);
    for (const [f, raw] of presets) {
      const cfg = parseExperiment(JSON.parse(raw), ALL_BOTS);
      expect(cfg.name.length, f).toBeGreaterThan(0);
      const games = expandGames(cfg, `test-${f}`, null);
      expect(games.length, f).toBe(cfg.games);
      expect(new Set(games.map((g) => g.id)).size, f).toBe(cfg.games);
    }
  });

  it("rules-*: dos variantes, la primera siempre es current", () => {
    for (const [f, raw] of presets.filter(([p]) => p.includes("rules-"))) {
      const cfg = parseExperiment(JSON.parse(raw), ALL_BOTS);
      expect(cfg.rules.length, f).toBe(2);
      expect(cfg.rules[0]!.variant, f).toBe("current");
      expect(cfg.rules[1]!.variant, f).not.toBe("current");
    }
  });
});
