import { describe, expect, it } from "vitest";
import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { PlayerState } from "../../domain/entities/PlayerState";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { MovementRuleEngine } from "./MovementRuleEngine";
import {
  canPlaceFromBench,
  getBenchPlacementSquares,
  getPlacementRows,
  getScoringRow,
  hasAnyLegalAction,
  hasAnyLegalMove,
} from "./turnRules";

const pos = (x: number, y: number) => new Position(x, y);
const emptyBoard = () => new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
const engine = new MovementRuleEngine();

const withBench = (playerState: PlayerState, player: Player, count = 1): PlayerState => {
  for (let i = 0; i < count; i++) {
    playerState.addBenchPiece(new GamePiece(`${player}-bench-${i}`, PieceType.FORT, null, player));
  }
  return playerState;
};

describe("getPlacementRows / getScoringRow", () => {
  it("devuelve las filas de despliegue y de anotación por bando", () => {
    expect(getPlacementRows(Player.BLANCAS)).toEqual([1, 2, 3]);
    expect(getPlacementRows(Player.NEGRAS)).toEqual([7, 8, 9]);
    expect(getScoringRow(Player.BLANCAS)).toBe(10);
    expect(getScoringRow(Player.NEGRAS)).toBe(0);
  });
});

describe("getBenchPlacementSquares", () => {
  it("devuelve las 15 casillas de despliegue en tablero vacío", () => {
    const board = emptyBoard();
    const white = getBenchPlacementSquares(board, Player.BLANCAS);
    const black = getBenchPlacementSquares(board, Player.NEGRAS);

    expect(white).toHaveLength(15);
    expect(white.every((p) => [1, 2, 3].includes(p.y))).toBe(true);
    expect(black).toHaveLength(15);
    expect(black.every((p) => [7, 8, 9].includes(p.y))).toBe(true);
  });

  it("excluye la fila que ya tiene MAX_PIECES_PER_ROW propias", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w-0", PieceType.FORT, pos(0, 1), Player.BLANCAS));
    board.addPiece(new GamePiece("w-1", PieceType.FORT, pos(1, 1), Player.BLANCAS));

    const squares = getBenchPlacementSquares(board, Player.BLANCAS);
    expect(squares).toHaveLength(10);
    expect(squares.every((p) => p.y !== 1)).toBe(true);
  });

  it("excluye la casilla ocupada aunque la fila no esté llena; las rivales no cuentan para MAX", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w-0", PieceType.FORT, pos(0, 2), Player.BLANCAS));
    board.addPiece(new GamePiece("b-0", PieceType.FORT, pos(1, 3), Player.NEGRAS));
    board.addPiece(new GamePiece("b-1", PieceType.FORT, pos(2, 3), Player.NEGRAS));

    const white = getBenchPlacementSquares(board, Player.BLANCAS);
    expect(white.some((p) => p.equals(pos(0, 2)))).toBe(false);
    // Las 2 negras en fila 3 no cierran la fila para blancas, solo sus casillas.
    expect(white.filter((p) => p.y === 3).map((p) => p.x)).toEqual([0, 3, 4]);
  });
});

describe("canPlaceFromBench", () => {
  it("es true con < 5 propias en tablero y banca no vacía", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w-0", PieceType.FORT, pos(0, 1), Player.BLANCAS));
    const ps = withBench(new PlayerState("player1"), Player.BLANCAS);
    expect(canPlaceFromBench(board, Player.BLANCAS, ps)).toBe(true);
  });

  it("es false con 5 propias en tablero o banca vacía", () => {
    const board = emptyBoard();
    [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2), pos(0, 3)].forEach((p, i) =>
      board.addPiece(new GamePiece(`w-${i}`, PieceType.FORT, p, Player.BLANCAS)),
    );
    const ps = withBench(new PlayerState("player1"), Player.BLANCAS);
    expect(canPlaceFromBench(board, Player.BLANCAS, ps)).toBe(false);

    const emptyBenchBoard = emptyBoard();
    expect(canPlaceFromBench(emptyBenchBoard, Player.BLANCAS, new PlayerState("player1"))).toBe(
      false,
    );
  });
});

describe("hasAnyLegalMove / hasAnyLegalAction", () => {
  it("hasAnyLegalMove es true si alguna pieza propia tiene movimientos", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w-0", PieceType.FORT, pos(0, 1), Player.BLANCAS));
    expect(hasAnyLegalMove(board, Player.BLANCAS, engine)).toBe(true);
    expect(hasAnyLegalMove(board, Player.NEGRAS, engine)).toBe(false);
  });

  it("hasAnyLegalMove es false si la única pieza propia no puede mover", () => {
    const board = emptyBoard();
    // NEGRAS en y=0 mira fuera del tablero: sin movimientos.
    board.addPiece(new GamePiece("b-0", PieceType.FORT, pos(0, 0), Player.NEGRAS));
    expect(hasAnyLegalMove(board, Player.NEGRAS, engine)).toBe(false);
  });

  it("hasAnyLegalAction es false sin piezas en tablero ni banca", () => {
    const board = emptyBoard();
    expect(hasAnyLegalAction(board, Player.BLANCAS, new PlayerState("player1"), engine)).toBe(
      false,
    );
  });

  it("hasAnyLegalAction es true con banca aunque no haya movimientos", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-0", PieceType.FORT, pos(0, 0), Player.NEGRAS));
    const ps = withBench(new PlayerState("player2"), Player.NEGRAS);
    expect(hasAnyLegalMove(board, Player.NEGRAS, engine)).toBe(false);
    expect(hasAnyLegalAction(board, Player.NEGRAS, ps, engine)).toBe(true);
  });

  it("hasAnyLegalAction es false con banca pero sin casillas de despliegue libres", () => {
    const board = emptyBoard();
    // 4 propias llenan filas 1 y 2; las 5 rivales tapan toda la fila 3.
    // PIONEER no captura y se bloquea con la primera casilla ocupada.
    [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2)].forEach((p, i) =>
      board.addPiece(new GamePiece(`w-${i}`, PieceType.PIONEER, p, Player.BLANCAS)),
    );
    for (let x = 0; x < GAME_CONFIG.BOARD_WIDTH; x++) {
      board.addPiece(new GamePiece(`b-${x}`, PieceType.FORT, pos(x, 3), Player.NEGRAS));
    }
    const ps = withBench(new PlayerState("player1"), Player.BLANCAS);
    expect(canPlaceFromBench(board, Player.BLANCAS, ps)).toBe(true);
    expect(getBenchPlacementSquares(board, Player.BLANCAS)).toHaveLength(0);
    expect(hasAnyLegalAction(board, Player.BLANCAS, ps, engine)).toBe(false);
  });
});
