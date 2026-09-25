import { describe, expect, it } from "vitest";
import { Board } from "./Board";
import { GamePiece } from "./GamePiece";
import { Position } from "./Position";
import { PieceType, Player } from "../constants/PieceConstants";

const pos = (x: number, y: number) => new Position(x, y);
const piece = (id: string, x: number, y: number, owner = Player.BLANCAS) =>
  new GamePiece(id, PieceType.FORT, pos(x, y), owner);

describe("Board positionIndex", () => {
  it("getPieceAt encuentra piezas agregadas, movidas y eliminadas", () => {
    const board = new Board(5, 11);
    board.addPiece(piece("a", 1, 2));
    expect(board.getPieceAt(pos(1, 2))?.id).toBe("a");
    expect(board.getPieceAt(pos(0, 0))).toBeUndefined();

    board.movePiece("a", pos(3, 4));
    expect(board.getPieceAt(pos(3, 4))?.id).toBe("a");
    expect(board.getPieceAt(pos(1, 2))).toBeUndefined();

    board.removePiece("a");
    expect(board.getPieceAt(pos(3, 4))).toBeUndefined();
  });

  it("getPieceAt correcto tras una captura", () => {
    const board = new Board(5, 11);
    board.addPiece(piece("a", 1, 1));
    board.addPiece(piece("b", 2, 2, Player.NEGRAS));
    board.movePiece("a", pos(2, 2));
    expect(board.getPieceAt(pos(2, 2))?.id).toBe("a");
    expect(board.getPieceById("b")).toBeUndefined();
  });

  it("se recupera si la pieza se mueve por fuera con piece.moveTo", () => {
    const board = new Board(5, 11);
    const p = piece("a", 1, 1);
    board.addPiece(p);
    p.moveTo(pos(4, 9)); // el índice queda viejo
    expect(board.getPieceAt(pos(4, 9))?.id).toBe("a");
    expect(board.getPieceAt(pos(1, 1))).toBeUndefined();
  });

  it("se recupera si una pieza externa ocupa una casilla indexada", () => {
    const board = new Board(5, 11);
    const p = piece("a", 1, 1);
    board.addPiece(p);
    p.moveTo(pos(4, 9));
    // La casilla vieja sigue en el índice hasta que alguien la consulta;
    // agregar otra pieza ahí debe devolver la nueva.
    board.addPiece(piece("b", 1, 1, Player.NEGRAS));
    expect(board.getPieceAt(pos(1, 1))?.id).toBe("b");
  });

  it("reset limpia el índice", () => {
    const board = new Board(5, 11);
    board.addPiece(piece("a", 1, 1));
    board.reset();
    expect(board.getPieceAt(pos(1, 1))).toBeUndefined();
    expect(board.getAllPieces()).toHaveLength(0);
  });

  it("getPiecesOf agrupa por dueño y se invalida en mutaciones", () => {
    const board = new Board(5, 11);
    board.addPiece(piece("a", 0, 0));
    board.addPiece(piece("b", 1, 1, Player.NEGRAS));
    expect(board.getPiecesOf(Player.BLANCAS).map((p) => p.id)).toEqual(["a"]);
    expect(board.getPiecesOf(Player.NEGRAS).map((p) => p.id)).toEqual(["b"]);
    board.removePiece("b");
    expect(board.getPiecesOf(Player.NEGRAS)).toHaveLength(0);
    board.addPiece(piece("c", 2, 2, Player.NEGRAS));
    expect(board.getPiecesOf(Player.NEGRAS).map((p) => p.id)).toEqual(["c"]);
  });

  it("micro-benchmark: 100k getPieceAt con 16 piezas", () => {
    const board = new Board(5, 11);
    for (let i = 0; i < 16; i++) {
      board.addPiece(piece(`p${i}`, i % 5, Math.floor(i / 5)));
    }
    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      board.getPieceAt(pos(i % 5, Math.floor(i / 5) % 11));
    }
    const ms = performance.now() - start;
    console.log(`100k getPieceAt: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(2_000);
  });
});
