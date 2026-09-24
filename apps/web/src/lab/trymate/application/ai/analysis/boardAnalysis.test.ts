import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import {
  PIECE_MOVEMENT_CONFIG,
  PieceType,
  Player,
  type PieceMovementConfigMap,
} from "../../../domain/constants/PieceConstants";
import { GAME_RULES } from "../../../domain/constants/GameRules";
import { GAME_CONFIG } from "../../../domain/constants/GameConstants";
import { buildRulesView, CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getRulesInsight } from "../introspection/profiles";
import { cloneBoard, opponentOf } from "../sim/SimState";
import { createSeededRng } from "../rng";
import { analyzeBoard } from "./boardAnalysis";

const engine = new MovementRuleEngine();
const insight = getRulesInsight(CURRENT_RULES, engine, engine.config);
const pos = (x: number, y: number) => new Position(x, y);
const emptyBoard = () => new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);

/** Escenarios escritos para las reglas actuales (tipos concretos permitidos en tests). */
describe("analyzeBoard — reglas actuales", () => {
  it("FORT blanco en (2,4) ataca (1,5) y (3,5); STRIKER negro en (2,6) ataca (2,5)", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(2, 4), Player.BLANCAS));
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 6), Player.NEGRAS));
    const A = analyzeBoard(board, engine, insight);
    expect(A.isAttacked(pos(1, 5), Player.BLANCAS)).toBe(true);
    expect(A.isAttacked(pos(3, 5), Player.BLANCAS)).toBe(true);
    expect(A.isAttacked(pos(2, 5), Player.BLANCAS)).toBe(false);
    expect(A.isAttacked(pos(2, 5), Player.NEGRAS)).toBe(true);
  });

  it("STRIKER blanco en (2,5) con FORT blanco en (1,4) está defendido", () => {
    const board = emptyBoard();
    const striker = new GamePiece("s", PieceType.STRIKER, pos(2, 5), Player.BLANCAS);
    board.addPiece(striker);
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(1, 4), Player.BLANCAS));
    const A = analyzeBoard(board, engine, insight);
    expect(A.isDefended(striker)).toBe(true);
  });

  it("PIONEER negro en (2,7) con blanca en (2,6) está taponeado", () => {
    const board = emptyBoard();
    const pioneer = new GamePiece("p", PieceType.PIONEER, pos(2, 7), Player.NEGRAS);
    board.addPiece(pioneer);
    board.addPiece(new GamePiece("w", PieceType.STRIKER, pos(2, 6), Player.BLANCAS));
    const A = analyzeBoard(board, engine, insight);
    expect(A.advanceMoves(pioneer)).toHaveLength(0);
    expect(A.isPlugged(pioneer, Player.BLANCAS)).toBe(true);
    expect(A.isAdvanceControlled(pioneer, Player.BLANCAS)).toBe(true);
  });

  it("corredor con todos sus avances atacados está controlado; sin atacantes, no", () => {
    const board = emptyBoard();
    const striker = new GamePiece("s", PieceType.STRIKER, pos(2, 8), Player.NEGRAS);
    board.addPiece(striker);
    // FORT blanco en (1,6) cubre (0,7) y (2,7); en (3,6) cubre (2,7) y (4,7).
    board.addPiece(new GamePiece("f1", PieceType.FORT, pos(1, 6), Player.BLANCAS));
    board.addPiece(new GamePiece("f2", PieceType.FORT, pos(3, 6), Player.BLANCAS));
    const A = analyzeBoard(board, engine, insight);
    // Avances del striker: (1,7),(2,7),(3,7) + carga (2,6)? (2,6) vacío → la carga avanza 2.
    // (1,7),(3,7) atacadas por FORTs; (2,7) atacada por ambos.
    expect(A.isAdvanceControlled(striker, Player.BLANCAS)).toBe(
      A.advanceMoves(striker).every((m) => A.isAttacked(m, Player.BLANCAS)),
    );
  });

  it("hasFreeLane: sin rivales por delante en el carril; isIsolated: sin propias cerca", () => {
    const board = emptyBoard();
    const pioneer = new GamePiece("p", PieceType.PIONEER, pos(0, 5), Player.BLANCAS);
    board.addPiece(pioneer);
    let A = analyzeBoard(board, engine, insight);
    expect(A.hasFreeLane(pioneer)).toBe(true);
    expect(A.isIsolated(pioneer)).toBe(true);

    board.addPiece(new GamePiece("e", PieceType.STRIKER, pos(1, 8), Player.NEGRAS));
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(2, 4), Player.BLANCAS));
    A = analyzeBoard(board, engine, insight);
    expect(A.hasFreeLane(pioneer)).toBe(false); // rival por delante a |dx| = 1
    expect(A.isIsolated(pioneer)).toBe(false); // FORT a Chebyshev 2 ≤ supportRadius
  });

  it("legalMoveCount suma las jugadas de un solo bando", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(2, 4), Player.BLANCAS));
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(0, 6), Player.NEGRAS));
    const A = analyzeBoard(board, engine, insight);
    expect(A.legalMoveCount(Player.BLANCAS)).toBe(1); // FORT solo avanza 1
    expect(A.legalMoveCount(Player.NEGRAS)).toBeGreaterThanOrEqual(3); // 3 dirs + carga
  });
});

describe("analyzeBoard — variantes", () => {
  it("7×13 con motor alterado: isAttacked coincide con poner un rival y consultar getValidMoves", () => {
    const rules = buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES);
    const config = structuredClone(PIECE_MOVEMENT_CONFIG) as PieceMovementConfigMap;
    config.FORT.capture = {
      directions: [
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 1,
    };
    const altEngine = new MovementRuleEngine(config);
    const altInsight = getRulesInsight(rules, altEngine, config);
    const rng = createSeededRng(42);

    const board = new Board(rules.width, rules.height);
    const types = rules.pieceTypes;
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(rng() * rules.width);
      const y = Math.floor(rng() * rules.height);
      const square = pos(x, y);
      if (board.getPieceAt(square)) continue;
      const type = types[Math.floor(rng() * types.length)]!;
      const owner = rng() < 0.5 ? Player.BLANCAS : Player.NEGRAS;
      board.addPiece(new GamePiece(`p-${i}`, type, square, owner));
    }

    const A = analyzeBoard(board, altEngine, altInsight);
    const probeType = types[0]!;
    let checked = 0;
    for (let i = 0; i < 50; i++) {
      const x = Math.floor(rng() * rules.width);
      const y = Math.floor(rng() * rules.height);
      const square = pos(x, y);
      for (const side of [Player.BLANCAS, Player.NEGRAS]) {
        const occupant = board.getPieceAt(square);
        if (occupant && occupant.owner === side) continue; // no se captura lo propio
        const clone = cloneBoard(board);
        if (!occupant) {
          clone.addPiece(new GamePiece(`probe-${i}-${side}`, probeType, square, opponentOf(side)));
        }
        const reachable = clone
          .getAllPieces()
          .some(
            (p) =>
              p.owner === side &&
              p.position &&
              altEngine.getValidMoves(p, clone).some((m) => m.equals(square)),
          );
        expect(A.isAttacked(square, side)).toBe(reachable);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("no lanza con piezas en los bordes", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("a", PieceType.FORT, pos(0, 0), Player.BLANCAS));
    board.addPiece(new GamePiece("b", PieceType.STRIKER, pos(4, 10), Player.NEGRAS));
    board.addPiece(new GamePiece("c", PieceType.PIONEER, pos(0, 10), Player.BLANCAS));
    const A = analyzeBoard(board, engine, insight);
    expect(A.legalMoveCount(Player.BLANCAS)).toBeGreaterThanOrEqual(0);
  });
});
