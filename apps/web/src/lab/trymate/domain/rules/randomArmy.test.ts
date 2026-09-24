import { describe, expect, it } from "vitest";
import { Player } from "../constants/PieceConstants";
import { GAME_RULES } from "../constants/GameRules";
import { buildRulesView, CURRENT_RULES, type RulesView } from "../config/RulesView";
import { countsOf, isCompositionFeasible } from "./composition";
import { generateRandomArmy } from "./randomArmy";

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const VARIANTS: { name: string; rules: RulesView }[] = [
  { name: "current", rules: CURRENT_RULES },
  {
    name: "wide-7x13",
    rules: buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES),
  },
  {
    name: "shallow-deploy",
    rules: buildRulesView(
      { BOARD_WIDTH: 5, BOARD_HEIGHT: 11 },
      { ...GAME_RULES, PLACEMENT_DEPTH: 2, MAX_PIECES_PER_ROW: 3 },
    ),
  },
  {
    name: "more-pieces",
    rules: buildRulesView(
      { BOARD_WIDTH: 5, BOARD_HEIGHT: 11 },
      { ...GAME_RULES, PIECES_TO_PLACE: 6, PIECES_IN_BENCH: 3, POINTS_TO_WIN: 4 },
    ),
  },
];

describe("generateRandomArmy", () => {
  for (const { name, rules } of VARIANTS) {
    it(`produce ejércitos válidos con la variante ${name} (200 semillas × 2 bandos)`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        for (const player of [Player.BLANCAS, Player.NEGRAS]) {
          const army = generateRandomArmy(rules, player, mulberry32(seed));

          expect(army.boardPieces).toHaveLength(rules.piecesToPlace);
          expect(army.benchPieces).toHaveLength(rules.benchSize);

          const rows = rules.placementRows(player);
          const seen = new Set<string>();
          const perRow = new Map<number, number>();
          for (const { position } of army.boardPieces) {
            expect(rows).toContain(position.y);
            expect(position.x).toBeGreaterThanOrEqual(0);
            expect(position.x).toBeLessThan(rules.width);
            const key = `${position.x},${position.y}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
            const n = (perRow.get(position.y) ?? 0) + 1;
            perRow.set(position.y, n);
            expect(n).toBeLessThanOrEqual(rules.maxPerRow);
          }

          const counts = countsOf(
            [...army.boardPieces.map((p) => p.type), ...army.benchPieces],
            rules,
          );
          expect(isCompositionFeasible(counts, 0, rules)).toBe(true);
        }
      }
    });
  }

  it("lanza con reglas imposibles (min 3 × 3 tipos con 5+3 slots)", () => {
    const impossible = buildRulesView(
      { BOARD_WIDTH: 5, BOARD_HEIGHT: 11 },
      { ...GAME_RULES, MIN_PIECES_PER_TYPE: 3 },
    );
    expect(() => generateRandomArmy(impossible, Player.BLANCAS, Math.random)).toThrow(
      /reglas imposibles/,
    );
  });
});
