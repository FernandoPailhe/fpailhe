import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import type { SimState } from "../sim/SimState";
import { getRulesInsight } from "../introspection/profiles";
import { RULE_VARIANTS } from "../testing/ruleVariants";
import { analyzeRunner, raceScore } from "./race";
import { SearchBoard } from "./SearchBoard";

const variant = RULE_VARIANTS[0]!;
const { rules } = variant;
const insight = getRulesInsight(rules, variant.engine, variant.engine.config);
const B = Player.BLANCAS;
const N = Player.NEGRAS;

const mkSb = (board: Board, current = B): SearchBoard =>
  new SearchBoard(
    {
      rules,
      board,
      current,
      scores: { [B]: 0, [N]: 0 },
      bench: { [B]: [], [N]: [] },
      winner: null,
    } as SimState,
    variant.engine,
  );

describe("analyzeRunner (reglas actuales)", () => {
  it("PIONEER con carril libre a 3 filas sin rivales → imparable", () => {
    const board = new Board(rules.width, rules.height);
    board.addPiece(new GamePiece("r", PieceType.PIONEER, new Position(2, 7), B));
    const sb = mkSb(board);
    const info = analyzeRunner(sb, "r", insight);
    expect(info.unstoppable).toBe(true);
    expect(info.turnsToScore).toBe(1);
  });

  it("corredor frenado y rival que llega a cubrir su camino → no imparable", () => {
    const board = new Board(rules.width, rules.height);
    // Corredor frenado por pieza propia (+1 turno para anotar).
    board.addPiece(new GamePiece("r", PieceType.PIONEER, new Position(2, 5), B));
    board.addPiece(new GamePiece("w", PieceType.FORT, new Position(2, 6), B));
    // STRIKER rival lejos del carril: (4,9) → (3,8) → (2,7) cubre el camino.
    board.addPiece(new GamePiece("s", PieceType.STRIKER, new Position(4, 9), N));
    const sb = mkSb(board);
    const info = analyzeRunner(sb, "r", insight);
    expect(info.unstoppable).toBe(false);
    expect(info.turnsToCatch).toBeLessThanOrEqual(3);
  });

  it("rival que ya cubre al corredor → no imparable", () => {
    const board = new Board(rules.width, rules.height);
    board.addPiece(new GamePiece("r", PieceType.PIONEER, new Position(2, 7), B));
    // FORT NEGRAS en (3,8): captura en diagonal (2,7) — ya cubre al corredor.
    board.addPiece(new GamePiece("f", PieceType.FORT, new Position(3, 8), N));
    const sb = mkSb(board);
    expect(analyzeRunner(sb, "r", insight).unstoppable).toBe(false);
  });

  it("pieza sin rol runner → no imparable", () => {
    const board = new Board(rules.width, rules.height);
    board.addPiece(new GamePiece("f", PieceType.FORT, new Position(2, 7), B));
    const sb = mkSb(board);
    expect(analyzeRunner(sb, "f", insight).unstoppable).toBe(false);
  });

  it("raceScore premia el corredor imparable del bot", () => {
    const board = new Board(rules.width, rules.height);
    board.addPiece(new GamePiece("r", PieceType.PIONEER, new Position(2, 7), B));
    const sb = mkSb(board);
    expect(raceScore(sb, B, insight)).toBeGreaterThan(0);
    expect(raceScore(sb, N, insight)).toBeLessThan(0);
  });
});
