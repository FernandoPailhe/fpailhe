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

describe("FORT", () => {
  it("moves exactly one square forward to an empty tile", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(fort, board);
    expect(moves).toHaveLength(1);
    expect(at(moves, 2, 3)).toBe(true);
  });

  it("cannot move diagonally to an empty tile", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 1, 3)).toBe(false);
    expect(at(moves, 3, 3)).toBe(false);
  });

  it("captures diagonally forward", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    add(PieceType.STRIKER, 3, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 3, 3)).toBe(true);
  });

  it("cannot capture the frontal tile", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    add(PieceType.STRIKER, 2, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 2, 3)).toBe(false);
  });
});

describe("STRIKER", () => {
  it("moves to the three forward diagonals and the double step", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 2, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
    expect(at(moves, 2, 4)).toBe(true);
    expect(moves).toHaveLength(4);
  });

  it("loses (2,3) and the double step when an own piece occupies (2,3)", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 2, 3)).toBe(false);
    expect(at(moves, 2, 4)).toBe(false);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
  });

  it("captures only straight ahead", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 1, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 3)).toBe(false);
  });

  it("can capture the frontal enemy", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 2, 3)).toBe(true);
  });
});

describe("PIONEER", () => {
  it("moves 1-3 forward plus one lateral after each forward step", () => {
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(pioneer, board);
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
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.BLANCAS);
    expect(engine.getValidMoves(pioneer, board)).toHaveLength(0);
  });

  it("has no moves when the first forward tile holds an enemy (cannot capture)", () => {
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.NEGRAS);
    expect(engine.getValidMoves(pioneer, board)).toHaveLength(0);
  });

  it("never lands on an occupied lateral target", () => {
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    add(PieceType.STRIKER, 3, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(pioneer, board);
    expect(at(moves, 3, 3)).toBe(false);
    expect(at(moves, 2, 3)).toBe(true);
  });
});

describe("FORT side-blocking", () => {
  it("blocks the adjacent tiles of an enemy fort", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
    expect(at(moves, 0, 5)).toBe(true);
  });

  it("prevents a striker from capturing inside the blocked zone", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    add(PieceType.PIONEER, 1, 5, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
  });

  it("prevents an allied fort from entering a blocked empty tile", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const fort = add(PieceType.FORT, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 1, 5)).toBe(false);
  });

  it("lets an allied fort bypass the block only by capturing", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const fort = add(PieceType.FORT, 0, 4, Player.BLANCAS);
    add(PieceType.STRIKER, 1, 5, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 1, 5)).toBe(true);
  });

  it("lets pioneer bypass when the blocker is two or more rows ahead", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const pioneer = add(PieceType.PIONEER, 1, 3, Player.BLANCAS);
    const moves = engine.getValidMoves(pioneer, board);
    expect(at(moves, 1, 5)).toBe(true);
  });

  it("blocks pioneer entirely when the blocker is one row ahead", () => {
    add(PieceType.FORT, 2, 4, Player.NEGRAS);
    const pioneer = add(PieceType.PIONEER, 1, 3, Player.BLANCAS);
    expect(engine.getValidMoves(pioneer, board)).toHaveLength(0);
  });

  it("does not block the fort owner's own pieces", () => {
    add(PieceType.FORT, 2, 5, Player.BLANCAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(true);
  });
});

describe("getBlockedMoves", () => {
  it("reports pattern-reachable tiles made illegal by a blocker", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const blocked = engine.getBlockedMoves(striker, board);
    expect(at(blocked, 1, 5)).toBe(true);
    expect(at(blocked, 0, 5)).toBe(false);
  });
});

describe("board limits", () => {
  it("never generates negative coordinates", () => {
    const striker = add(PieceType.STRIKER, 0, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(moves.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
    expect(at(moves, 0, 3)).toBe(true);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 0, 4)).toBe(true);
    expect(moves).toHaveLength(3);
  });

  it("a blancas piece on the last row has no moves", () => {
    const fort = add(PieceType.FORT, 2, 10, Player.BLANCAS);
    expect(engine.getValidMoves(fort, board)).toHaveLength(0);
  });
});

describe("NEGRAS symmetry", () => {
  it("fort moves one square towards y=0", () => {
    const fort = add(PieceType.FORT, 2, 8, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(moves).toHaveLength(1);
    expect(at(moves, 2, 7)).toBe(true);
  });

  it("striker mirrors the same fan", () => {
    const striker = add(PieceType.STRIKER, 2, 8, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 7)).toBe(true);
    expect(at(moves, 2, 7)).toBe(true);
    expect(at(moves, 3, 7)).toBe(true);
    expect(at(moves, 2, 6)).toBe(true);
    expect(moves).toHaveLength(4);
  });

  it("a blancas fort blocks sides for negras pieces", () => {
    add(PieceType.FORT, 2, 5, Player.BLANCAS);
    const striker = add(PieceType.STRIKER, 1, 6, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
  });
});
