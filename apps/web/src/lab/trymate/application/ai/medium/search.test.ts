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
import { buildRulesView, CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getRulesInsight } from "../introspection/profiles";
import { createSeededRng } from "../rng";
import { generateMoves, type SimState } from "../sim/SimState";
import { MEDIUM_BOT_CONFIG, NEUTRAL_WEIGHTS } from "./config";
import { searchBestMove } from "./search";

const engine = new MovementRuleEngine();
const insight = getRulesInsight(CURRENT_RULES, engine, engine.config);
const pos = (x: number, y: number) => new Position(x, y);
const BOT = Player.NEGRAS;
const HUMAN = Player.BLANCAS;
const noBlunder = () => 0.9;

const mkState = (board: Board, overrides: Partial<SimState> = {}): SimState => ({
  rules: CURRENT_RULES,
  board,
  current: BOT,
  scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
  bench: { [Player.BLANCAS]: [], [Player.NEGRAS]: [] },
  winner: null,
  ...overrides,
});

const search = (state: SimState, rng = noBlunder) =>
  searchBestMove(state, BOT, engine, insight, NEUTRAL_WEIGHTS, rng);

/** Escenarios escritos para las reglas actuales (tipos permitidos en tests). */
describe("searchBestMove — reglas actuales", () => {
  it("anota para ganar con 2 puntos y pieza a 1 de la meta", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(0, 1), BOT));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(4, 8), HUMAN));
    const result = search(
      mkState(board, {
        scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: CURRENT_RULES.pointsToWin - 1 },
      }),
    );
    expect(result.move).not.toBeNull();
    expect(result.move!.pieceId).toBe("s");
    expect(result.move!.to.equals(pos(0, 0))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(MEDIUM_BOT_CONFIG.winValue / 2);
  });

  it("frena corredor: captura al striker rival a 2 de anotar", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(1, 3), BOT)); // captura (2,2)
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 2), HUMAN));
    const result = search(mkState(board));
    expect(result.move!.pieceId).toBe("f");
    expect(result.move!.to.equals(pos(2, 2))).toBe(true);
  });

  it("no cuelga: evita casillas atacadas sin defensa", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT));
    // FORTs blancos cubren las diagonales de avance (1,4) y (3,4).
    board.addPiece(new GamePiece("w1", PieceType.FORT, pos(0, 3), HUMAN));
    board.addPiece(new GamePiece("w2", PieceType.FORT, pos(4, 3), HUMAN));
    const result = search(mkState(board));
    expect(result.move).not.toBeNull();
    const { to } = result.move!;
    expect(to.equals(pos(1, 4))).toBe(false);
    expect(to.equals(pos(3, 4))).toBe(false);
  });

  it("captura una pieza indefensa", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(2, 4), HUMAN));
    const result = search(mkState(board));
    expect(result.move!.pieceId).toBe("s");
    expect(result.move!.to.equals(pos(2, 4))).toBe(true);
  });

  it("presupuesto chico: devuelve jugada válida con depth ≥ 1", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(0, 8), HUMAN));
    const state = mkState(board);
    const result = searchBestMove(state, BOT, engine, insight, NEUTRAL_WEIGHTS, noBlunder, {
      ...MEDIUM_BOT_CONFIG.search,
      nodeBudget: 50,
    });
    expect(result.move).not.toBeNull();
    const legal = generateMoves(state, engine).some(
      (m) => m.pieceId === result.move!.pieceId && m.to.equals(result.move!.to),
    );
    expect(legal).toBe(true);
    expect(result.depth).toBeGreaterThanOrEqual(1);
  });

  it("determinista con el mismo rng sembrado", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT));
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(0, 6), BOT));
    board.addPiece(new GamePiece("w", PieceType.STRIKER, pos(3, 4), HUMAN));
    const state = mkState(board);
    const a = search(state, createSeededRng(7));
    const b = search(state, createSeededRng(7));
    expect(a.move!.pieceId).toBe(b.move!.pieceId);
    expect(a.move!.to.equals(b.move!.to)).toBe(true);
    expect(a.score).toBe(b.score);
  });
});

describe("searchBestMove — variante 7×13 + motor alterado", () => {
  it("devuelve solo jugadas presentes en generateMoves y no lanza", () => {
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
    config.STRIKER.alternativeMovement = {
      directions: [{ dx: 0, dy: 1 }],
      minDistance: 3,
      maxDistance: 3,
      canCapture: false,
      requiresClearPath: true,
    };
    const altEngine = new MovementRuleEngine(config);
    const altInsight = getRulesInsight(rules, altEngine, config);
    const board = new Board(rules.width, rules.height);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(3, 6), BOT));
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(1, 8), BOT));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(4, 5), HUMAN));
    const state: SimState = {
      rules,
      board,
      current: BOT,
      scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
      bench: { [Player.BLANCAS]: [], [Player.NEGRAS]: [] },
      winner: null,
    };
    const result = searchBestMove(
      state,
      BOT,
      altEngine,
      altInsight,
      NEUTRAL_WEIGHTS,
      createSeededRng(3),
    );
    expect(result.move).not.toBeNull();
    const legal = generateMoves(state, altEngine).some(
      (m) => m.pieceId === result.move!.pieceId && m.to.equals(result.move!.to),
    );
    expect(legal).toBe(true);
  });
});
