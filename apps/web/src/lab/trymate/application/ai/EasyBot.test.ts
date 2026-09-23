import { describe, expect, it } from "vitest";
import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { PlayerState } from "../../domain/entities/PlayerState";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { QUICK_START_LAYOUTS, resolveQuickStartLayout } from "../../domain/config/QuickStartLayout";
import {
  choosePlayAction,
  getThreatenedSquares,
  nextBenchType,
  nextSetupPlacement,
  pickBotLayoutId,
  type Rng,
} from "./EasyBot";

const pos = (x: number, y: number) => new Position(x, y);
const emptyBoard = () => new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
const engine = new MovementRuleEngine();
const BOT = Player.NEGRAS;

// rng fijo ≥ randomMoveChance y con índice 0 en el topK → siempre el mejor.
const bestPick: Rng = () => 0.31;
// rng fijo < randomMoveChance → rama aleatoria, índice 0.
const firstRandom: Rng = () => 0;

const boardSnapshot = (board: Board) =>
  board
    .getAllPieces()
    .map((p) => `${p.id}:${p.type}:${p.owner}:${p.position?.x},${p.position?.y}`)
    .sort();

describe("pickBotLayoutId", () => {
  it("devuelve un id de QUICK_START_LAYOUTS", () => {
    const id = pickBotLayoutId(firstRandom);
    expect(QUICK_START_LAYOUTS.some((l) => l.id === id)).toBe(true);
    expect(pickBotLayoutId(() => 0.999)).toBe(
      QUICK_START_LAYOUTS[QUICK_START_LAYOUTS.length - 1]!.id,
    );
  });
});

describe("nextSetupPlacement", () => {
  it("recorre las 5 piezas del layout (espejado para NEGRAS) y luego devuelve null", () => {
    const layout = resolveQuickStartLayout(BOT, "classic");
    const board = emptyBoard();

    const first = nextSetupPlacement(board, BOT, layout);
    expect(first?.type).toBe(PieceType.FORT);
    expect(first?.position.equals(pos(1, 9))).toBe(true);
    board.addPiece(new GamePiece("b-0", first!.type, first!.position, BOT));

    const second = nextSetupPlacement(board, BOT, layout);
    expect(second?.position.equals(pos(3, 9))).toBe(true);
    board.addPiece(new GamePiece("b-1", second!.type, second!.position, BOT));

    // Completa el resto del layout.
    for (let i = 0; i < 3; i++) {
      const next = nextSetupPlacement(board, BOT, layout);
      expect(next).not.toBeNull();
      board.addPiece(new GamePiece(`b-${i + 2}`, next!.type, next!.position, BOT));
    }
    expect(nextSetupPlacement(board, BOT, layout)).toBeNull();
    expect(board.getAllPieces()).toHaveLength(5);
  });

  it("salta casillas ocupadas por el rival (defensivo)", () => {
    const layout = resolveQuickStartLayout(BOT, "classic");
    const board = emptyBoard();
    board.addPiece(new GamePiece("w-0", PieceType.FORT, pos(1, 9), Player.BLANCAS));
    const next = nextSetupPlacement(board, BOT, layout);
    expect(next?.position.equals(pos(3, 9))).toBe(true);
  });
});

describe("nextBenchType", () => {
  it("completa exactamente layout.benchPieces como multiset", () => {
    const layout = resolveQuickStartLayout(BOT, "classic"); // bench: S, P, F
    const ps = new PlayerState("player2");

    expect(nextBenchType(ps, layout)).toBe(PieceType.STRIKER);
    ps.addBenchPiece(new GamePiece("bb-0", PieceType.STRIKER, null, BOT));
    expect(nextBenchType(ps, layout)).toBe(PieceType.PIONEER);
    ps.addBenchPiece(new GamePiece("bb-1", PieceType.PIONEER, null, BOT));
    expect(nextBenchType(ps, layout)).toBe(PieceType.FORT);
    ps.addBenchPiece(new GamePiece("bb-2", PieceType.FORT, null, BOT));
    expect(nextBenchType(ps, layout)).toBeNull();
  });

  it("cuenta duplicados: vanguard tiene 2 FORT de banca", () => {
    const layout = resolveQuickStartLayout(BOT, "vanguard"); // bench: F, F, S
    const ps = new PlayerState("player2");
    ps.addBenchPiece(new GamePiece("bb-0", PieceType.FORT, null, BOT));
    expect(nextBenchType(ps, layout)).toBe(PieceType.FORT);
  });
});

describe("getThreatenedSquares", () => {
  it("marca diagonales de FORT y frente de STRIKER, en dirección del rival", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w-f", PieceType.FORT, pos(2, 5), Player.BLANCAS));
    board.addPiece(new GamePiece("w-s", PieceType.STRIKER, pos(0, 3), Player.BLANCAS));
    board.addPiece(new GamePiece("w-p", PieceType.PIONEER, pos(4, 4), Player.BLANCAS));

    const threatened = getThreatenedSquares(board, BOT);
    // FORT blanco (dir +1) amenaza (1,6) y (3,6); STRIKER amenaza (0,4);
    // PIONEER no amenaza.
    expect(threatened.has("1,6")).toBe(true);
    expect(threatened.has("3,6")).toBe(true);
    expect(threatened.has("0,4")).toBe(true);
    expect(threatened.size).toBe(3);
  });

  it("no lanza con piezas rivales en los bordes", () => {
    const board = emptyBoard();
    // FORT rival en el borde izquierdo: (x-1) queda fuera y se descarta.
    board.addPiece(new GamePiece("b-f", PieceType.FORT, pos(0, 5), BOT));
    // STRIKER rival en la última fila: solo amenaza dentro del tablero.
    board.addPiece(new GamePiece("b-s", PieceType.STRIKER, pos(4, 10), BOT));
    // Pieza propia del bot: no amenaza.
    board.addPiece(new GamePiece("w-f", PieceType.FORT, pos(2, 2), Player.BLANCAS));

    const threatened = getThreatenedSquares(board, Player.BLANCAS);
    expect(threatened.has("1,4")).toBe(true); // diagonal derecha del FORT
    expect(threatened.has("4,9")).toBe(true); // frente del STRIKER
    expect(threatened.size).toBe(2);
  });
});

describe("choosePlayAction", () => {
  it("baja banca en la fila de despliegue más adelantada (NEGRAS → y=7)", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-0", PieceType.STRIKER, pos(2, 5), BOT));
    board.addPiece(new GamePiece("b-1", PieceType.FORT, pos(0, 5), BOT));
    board.addPiece(new GamePiece("w-0", PieceType.FORT, pos(4, 4), Player.BLANCAS));
    const ps = new PlayerState("player2");
    ps.addBenchPiece(new GamePiece("bb-0", PieceType.PIONEER, null, BOT));

    const action = choosePlayAction(board, BOT, ps, engine, bestPick);
    expect(action.kind).toBe("bench");
    if (action.kind === "bench") {
      expect(action.benchPieceId).toBe("bb-0");
      expect(action.to.y).toBe(7);
    }
  });

  it("prefiere anotar cuando una pieza puede llegar a la fila de anotación", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-s", PieceType.STRIKER, pos(2, 1), BOT));
    board.addPiece(new GamePiece("b-f", PieceType.FORT, pos(4, 9), BOT));

    const action = choosePlayAction(board, BOT, new PlayerState("player2"), engine, bestPick);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      expect(action.pieceId).toBe("b-s");
      expect(action.to.y).toBe(0); // fila de anotación de NEGRAS
    }
  });

  it("prefiere capturar frente a avanzar 1", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-f", PieceType.FORT, pos(2, 5), BOT));
    board.addPiece(new GamePiece("w-s", PieceType.STRIKER, pos(3, 4), Player.BLANCAS));

    const action = choosePlayAction(board, BOT, new PlayerState("player2"), engine, bestPick);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      expect(action.to.equals(pos(3, 4))).toBe(true); // captura diagonal del FORT
    }
  });

  it("con rng bajo elige un candidato al azar (el primero con rng=0)", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-s", PieceType.STRIKER, pos(2, 5), BOT));

    const action = choosePlayAction(board, BOT, new PlayerState("player2"), engine, firstRandom);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      // Primer candidato generado: movimiento recto a (2,4).
      expect(action.to.equals(pos(2, 4))).toBe(true);
    }
  });

  it("sin movimientos ni banca devuelve pass", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-f", PieceType.FORT, pos(0, 0), BOT));
    const action = choosePlayAction(board, BOT, new PlayerState("player2"), engine, bestPick);
    expect(action.kind).toBe("pass");
  });

  it("con banca pero sin casillas de despliegue cae a movimientos", () => {
    const board = emptyBoard();
    // 4 propias tapan filas 7-8; las rivales tapan toda la fila 9.
    [pos(0, 7), pos(1, 7), pos(0, 8), pos(1, 8)].forEach((p, i) =>
      board.addPiece(new GamePiece(`b-p${i}`, PieceType.PIONEER, p, BOT)),
    );
    for (let x = 0; x < GAME_CONFIG.BOARD_WIDTH; x++) {
      board.addPiece(new GamePiece(`w-f${x}`, PieceType.FORT, pos(x, 9), Player.BLANCAS));
    }
    const ps = new PlayerState("player2");
    ps.addBenchPiece(new GamePiece("bb-0", PieceType.FORT, null, BOT));

    const action = choosePlayAction(board, BOT, ps, engine, bestPick);
    expect(action.kind).not.toBe("bench");
  });

  it("no muta el tablero", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-s", PieceType.STRIKER, pos(2, 5), BOT));
    board.addPiece(new GamePiece("w-f", PieceType.FORT, pos(1, 4), Player.BLANCAS));
    const before = boardSnapshot(board);
    choosePlayAction(board, BOT, new PlayerState("player2"), engine, () => 0.5);
    choosePlayAction(board, BOT, new PlayerState("player2"), engine, firstRandom);
    expect(boardSnapshot(board)).toEqual(before);
  });
});
