import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { getRulesInsight } from "../introspection/profiles";
import { RULE_VARIANTS } from "../testing/ruleVariants";
import { seeBalance, staticExchange } from "./see";

const variant = RULE_VARIANTS[0]!;
const insight = getRulesInsight(variant.rules, variant.engine, variant.engine.config);
const B = Player.BLANCAS;
const N = Player.NEGRAS;

const val = (t: PieceType) => insight.profiles.get(t)!.value;

describe("staticExchange (reglas actuales)", () => {
  it("pieza indefensa → SEE = su valor", () => {
    const board = new Board(variant.rules.width, variant.rules.height);
    board.addPiece(new GamePiece("a", PieceType.FORT, new Position(1, 4), B));
    board.addPiece(new GamePiece("v", PieceType.STRIKER, new Position(2, 5), N));
    const see = staticExchange(board, new Position(2, 5), B, variant.engine, insight);
    expect(see).toBeCloseTo(val(PieceType.STRIKER), 5);
  });

  it("pieza defendida atacada por pieza de mayor valor → SEE < 0", () => {
    const board = new Board(variant.rules.width, variant.rules.height);
    board.addPiece(new GamePiece("a", PieceType.FORT, new Position(1, 4), B));
    board.addPiece(new GamePiece("v", PieceType.STRIKER, new Position(2, 5), N));
    // Defensor rival: FORT en (3,6) captura (2,5) en diagonal.
    board.addPiece(new GamePiece("d", PieceType.FORT, new Position(3, 6), N));
    const see = staticExchange(board, new Position(2, 5), B, variant.engine, insight);
    expect(see).toBeLessThan(0);
    expect(see).toBeCloseTo(val(PieceType.STRIKER) - val(PieceType.FORT), 5);
  });

  it("intercambio parejo → SEE ≈ 0", () => {
    const board = new Board(variant.rules.width, variant.rules.height);
    board.addPiece(new GamePiece("a", PieceType.FORT, new Position(1, 4), B));
    board.addPiece(new GamePiece("v", PieceType.FORT, new Position(2, 5), N));
    board.addPiece(new GamePiece("d", PieceType.FORT, new Position(3, 6), N));
    const see = staticExchange(board, new Position(2, 5), B, variant.engine, insight);
    expect(Math.abs(see)).toBeLessThan(0.01);
  });

  it("casilla sin pieza rival → 0", () => {
    const board = new Board(variant.rules.width, variant.rules.height);
    board.addPiece(new GamePiece("a", PieceType.FORT, new Position(1, 4), B));
    expect(staticExchange(board, new Position(2, 5), B, variant.engine, insight)).toBe(0);
    expect(staticExchange(board, new Position(1, 4), B, variant.engine, insight)).toBe(0);
  });
});

describe("seeBalance", () => {
  it("premia capturas gratis del lado que mueve", () => {
    const board = new Board(variant.rules.width, variant.rules.height);
    board.addPiece(new GamePiece("a", PieceType.FORT, new Position(1, 4), B));
    board.addPiece(new GamePiece("v", PieceType.STRIKER, new Position(2, 5), N));
    expect(seeBalance(board, B, variant.engine, insight)).toBeGreaterThan(0);
  });

  it("variante 7×13: no lanza y signo coherente", () => {
    const wide = RULE_VARIANTS.find((v) => v.name === "wide-7x13")!;
    const wi = getRulesInsight(wide.rules, wide.engine, wide.engine.config);
    const board = new Board(wide.rules.width, wide.rules.height);
    board.addPiece(new GamePiece("a", PieceType.FORT, new Position(3, 5), B));
    board.addPiece(new GamePiece("v", PieceType.STRIKER, new Position(4, 6), N));
    const see = staticExchange(board, new Position(4, 6), B, wide.engine, wi);
    expect(see).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(seeBalance(board, B, wide.engine, wi))).toBe(true);
  });
});
