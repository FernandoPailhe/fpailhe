import { describe, expect, it } from "vitest";
import { Player } from "../constants/PieceConstants";
import { GAME_RULES } from "../constants/GameRules";
import { buildRulesView, CURRENT_RULES, rulesFingerprint } from "./RulesView";

describe("CURRENT_RULES", () => {
  it("deriva filas, anotación, base y dirección de las reglas actuales", () => {
    expect(CURRENT_RULES.width).toBe(5);
    expect(CURRENT_RULES.height).toBe(11);
    expect(CURRENT_RULES.placementRows(Player.BLANCAS)).toEqual([1, 2, 3]);
    expect(CURRENT_RULES.placementRows(Player.NEGRAS)).toEqual([7, 8, 9]);
    expect(CURRENT_RULES.scoringRow(Player.BLANCAS)).toBe(10);
    expect(CURRENT_RULES.scoringRow(Player.NEGRAS)).toBe(0);
    expect(CURRENT_RULES.homeRow(Player.BLANCAS)).toBe(0);
    expect(CURRENT_RULES.homeRow(Player.NEGRAS)).toBe(10);
    expect(CURRENT_RULES.forward(Player.BLANCAS)).toBe(1);
    expect(CURRENT_RULES.forward(Player.NEGRAS)).toBe(-1);
  });

  it("equivale a las constantes derivadas de GAME_RULES", () => {
    expect(CURRENT_RULES.placementRows(Player.BLANCAS)).toEqual(GAME_RULES.PLACEMENT_ROWS_PLAYER1);
    expect(CURRENT_RULES.placementRows(Player.NEGRAS)).toEqual(GAME_RULES.PLACEMENT_ROWS_PLAYER2);
    expect(CURRENT_RULES.scoringRow(Player.BLANCAS)).toBe(GAME_RULES.SCORING_ZONE_PLAYER1);
    expect(CURRENT_RULES.scoringRow(Player.NEGRAS)).toBe(GAME_RULES.SCORING_ZONE_PLAYER2);
    expect(CURRENT_RULES.piecesToPlace).toBe(GAME_RULES.PIECES_TO_PLACE);
    expect(CURRENT_RULES.benchSize).toBe(GAME_RULES.PIECES_IN_BENCH);
    expect(CURRENT_RULES.pointsToWin).toBe(GAME_RULES.POINTS_TO_WIN);
  });
});

describe("buildRulesView", () => {
  it("con 7×13 y profundidad 2 produce filas y anotación coherentes", () => {
    const variant = buildRulesView(
      { BOARD_WIDTH: 7, BOARD_HEIGHT: 13 },
      { ...GAME_RULES, PLACEMENT_DEPTH: 2 },
    );
    expect(variant.placementRows(Player.BLANCAS)).toEqual([1, 2]);
    expect(variant.placementRows(Player.NEGRAS)).toEqual([10, 11]);
    expect(variant.scoringRow(Player.BLANCAS)).toBe(12);
    expect(variant.scoringRow(Player.NEGRAS)).toBe(0);
    expect(variant.homeRow(Player.NEGRAS)).toBe(12);
    expect(variant.forward(Player.NEGRAS)).toBe(-1);
  });
});

describe("rulesFingerprint", () => {
  it("distingue variantes de reglas y es estable", () => {
    const other = buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES);
    const fp1 = rulesFingerprint(CURRENT_RULES, { a: 1 });
    expect(rulesFingerprint(CURRENT_RULES, { a: 1 })).toBe(fp1);
    expect(rulesFingerprint(other, { a: 1 })).not.toBe(fp1);
    expect(rulesFingerprint(CURRENT_RULES, { a: 2 })).not.toBe(fp1);
  });
});
