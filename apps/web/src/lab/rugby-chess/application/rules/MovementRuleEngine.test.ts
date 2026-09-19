import { beforeEach, describe, expect, it } from "vitest";
import { MovementRuleEngine } from "./MovementRuleEngine";
import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";

const engine = new MovementRuleEngine();
let board: Board;

const add = (type: PieceType, x: number, y: number, owner: Player): GamePiece => {
  const piece = new GamePiece(`t-${type}-${x}-${y}-${owner}`, type, new Position(x, y), owner);
  board.addPiece(piece);
  return piece;
};

const at = (moves: Position[], x: number, y: number): boolean =>
  moves.some((p) => p.x === x && p.y === y);

beforeEach(() => {
  board = new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
});

describe("BULWARK", () => {
  it("moves exactly one square forward to an empty tile", () => {
    const bulwark = add(PieceType.BULWARK, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(bulwark, board);
    expect(moves).toHaveLength(1);
    expect(at(moves, 2, 3)).toBe(true);
  });

  it("cannot move diagonally to an empty tile", () => {
    const bulwark = add(PieceType.BULWARK, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(bulwark, board);
    expect(at(moves, 1, 3)).toBe(false);
    expect(at(moves, 3, 3)).toBe(false);
  });

  it("captures diagonally forward", () => {
    const bulwark = add(PieceType.BULWARK, 2, 2, Player.BLANCAS);
    add(PieceType.VANGUARD, 3, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(bulwark, board);
    expect(at(moves, 3, 3)).toBe(true);
  });

  it("cannot capture the frontal tile", () => {
    const bulwark = add(PieceType.BULWARK, 2, 2, Player.BLANCAS);
    add(PieceType.VANGUARD, 2, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(bulwark, board);
    expect(at(moves, 2, 3)).toBe(false);
  });
});

describe("VANGUARD", () => {
  it("moves to the three forward diagonals and the double step", () => {
    const vanguard = add(PieceType.VANGUARD, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 2, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
    expect(at(moves, 2, 4)).toBe(true);
    expect(moves).toHaveLength(4);
  });

  it("loses (2,3) and the double step when an own piece occupies (2,3)", () => {
    const vanguard = add(PieceType.VANGUARD, 2, 2, Player.BLANCAS);
    add(PieceType.BULWARK, 2, 3, Player.BLANCAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 2, 3)).toBe(false);
    expect(at(moves, 2, 4)).toBe(false);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
  });

  it("captures only straight ahead", () => {
    const vanguard = add(PieceType.VANGUARD, 2, 2, Player.BLANCAS);
    add(PieceType.BULWARK, 1, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 1, 3)).toBe(false);
  });

  it("can capture the frontal enemy", () => {
    const vanguard = add(PieceType.VANGUARD, 2, 2, Player.BLANCAS);
    add(PieceType.BULWARK, 2, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 2, 3)).toBe(true);
  });
});

describe("APEX", () => {
  it("moves 1-3 forward plus one lateral after each forward step", () => {
    const apex = add(PieceType.APEX, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(apex, board);
    expect(at(moves, 2, 3)).toBe(true);
    expect(at(moves, 2, 4)).toBe(true);
    expect(at(moves, 2, 5)).toBe(true);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
    expect(at(moves, 1, 4)).toBe(true);
    expect(at(moves, 3, 4)).toBe(true);
    expect(moves).toHaveLength(7);
  });

  it("has no moves when the first forward tile is occupied", () => {
    const apex = add(PieceType.APEX, 2, 2, Player.BLANCAS);
    add(PieceType.BULWARK, 2, 3, Player.BLANCAS);
    expect(engine.getValidMoves(apex, board)).toHaveLength(0);
  });

  it("has no moves when the first forward tile holds an enemy (cannot capture)", () => {
    const apex = add(PieceType.APEX, 2, 2, Player.BLANCAS);
    add(PieceType.BULWARK, 2, 3, Player.NEGRAS);
    expect(engine.getValidMoves(apex, board)).toHaveLength(0);
  });

  it("never lands on an occupied lateral target", () => {
    const apex = add(PieceType.APEX, 2, 2, Player.BLANCAS);
    add(PieceType.VANGUARD, 3, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(apex, board);
    expect(at(moves, 3, 3)).toBe(false);
    expect(at(moves, 2, 3)).toBe(true);
  });
});

describe("BULWARK side-blocking", () => {
  it("blocks the adjacent tiles of an enemy bulwark", () => {
    add(PieceType.BULWARK, 2, 5, Player.NEGRAS);
    const vanguard = add(PieceType.VANGUARD, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 1, 5)).toBe(false);
    expect(at(moves, 0, 5)).toBe(true);
  });

  it("prevents a vanguard from capturing inside the blocked zone", () => {
    add(PieceType.BULWARK, 2, 5, Player.NEGRAS);
    const vanguard = add(PieceType.VANGUARD, 1, 4, Player.BLANCAS);
    add(PieceType.APEX, 1, 5, Player.NEGRAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 1, 5)).toBe(false);
  });

  it("prevents an allied bulwark from entering a blocked empty tile", () => {
    add(PieceType.BULWARK, 2, 5, Player.NEGRAS);
    const bulwark = add(PieceType.BULWARK, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(bulwark, board);
    expect(at(moves, 1, 5)).toBe(false);
  });

  it("lets an allied bulwark bypass the block only by capturing", () => {
    add(PieceType.BULWARK, 2, 5, Player.NEGRAS);
    const bulwark = add(PieceType.BULWARK, 0, 4, Player.BLANCAS);
    add(PieceType.VANGUARD, 1, 5, Player.NEGRAS);
    const moves = engine.getValidMoves(bulwark, board);
    expect(at(moves, 1, 5)).toBe(true);
  });

  it("lets apex bypass when the blocker is two or more rows ahead", () => {
    add(PieceType.BULWARK, 2, 5, Player.NEGRAS);
    const apex = add(PieceType.APEX, 1, 3, Player.BLANCAS);
    const moves = engine.getValidMoves(apex, board);
    expect(at(moves, 1, 5)).toBe(true);
  });

  it("blocks apex entirely when the blocker is one row ahead", () => {
    add(PieceType.BULWARK, 2, 4, Player.NEGRAS);
    const apex = add(PieceType.APEX, 1, 3, Player.BLANCAS);
    expect(engine.getValidMoves(apex, board)).toHaveLength(0);
  });

  it("does not block the bulwark owner's own pieces", () => {
    add(PieceType.BULWARK, 2, 5, Player.BLANCAS);
    const vanguard = add(PieceType.VANGUARD, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 1, 5)).toBe(true);
  });
});

describe("getBlockedMoves", () => {
  it("reports pattern-reachable tiles made illegal by a blocker", () => {
    add(PieceType.BULWARK, 2, 5, Player.NEGRAS);
    const vanguard = add(PieceType.VANGUARD, 1, 4, Player.BLANCAS);
    const blocked = engine.getBlockedMoves(vanguard, board);
    expect(at(blocked, 1, 5)).toBe(true);
    expect(at(blocked, 0, 5)).toBe(false);
  });
});

describe("board limits", () => {
  it("never generates negative coordinates", () => {
    const vanguard = add(PieceType.VANGUARD, 0, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(moves.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
    expect(at(moves, 0, 3)).toBe(true);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 0, 4)).toBe(true);
    expect(moves).toHaveLength(3);
  });

  it("a blancas piece on the last row has no moves", () => {
    const bulwark = add(PieceType.BULWARK, 2, 10, Player.BLANCAS);
    expect(engine.getValidMoves(bulwark, board)).toHaveLength(0);
  });
});

describe("NEGRAS symmetry", () => {
  it("bulwark moves one square towards y=0", () => {
    const bulwark = add(PieceType.BULWARK, 2, 8, Player.NEGRAS);
    const moves = engine.getValidMoves(bulwark, board);
    expect(moves).toHaveLength(1);
    expect(at(moves, 2, 7)).toBe(true);
  });

  it("vanguard mirrors the same fan", () => {
    const vanguard = add(PieceType.VANGUARD, 2, 8, Player.NEGRAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 1, 7)).toBe(true);
    expect(at(moves, 2, 7)).toBe(true);
    expect(at(moves, 3, 7)).toBe(true);
    expect(at(moves, 2, 6)).toBe(true);
    expect(moves).toHaveLength(4);
  });

  it("a blancas bulwark blocks sides for negras pieces", () => {
    add(PieceType.BULWARK, 2, 5, Player.BLANCAS);
    const vanguard = add(PieceType.VANGUARD, 1, 6, Player.NEGRAS);
    const moves = engine.getValidMoves(vanguard, board);
    expect(at(moves, 1, 5)).toBe(false);
  });
});
