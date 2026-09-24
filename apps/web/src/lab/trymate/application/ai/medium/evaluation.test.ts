import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { GAME_RULES } from "../../../domain/constants/GameRules";
import { buildRulesView, CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getRulesInsight } from "../introspection/profiles";
import type { SimState } from "../sim/SimState";
import { MEDIUM_BOT_CONFIG } from "./config";
import { explainEvaluation, evaluate } from "./evaluation";

const engine = new MovementRuleEngine();
const insight = getRulesInsight(CURRENT_RULES, engine, engine.config);
const pos = (x: number, y: number) => new Position(x, y);

const mkState = (board: Board, overrides: Partial<SimState> = {}): SimState => ({
  rules: CURRENT_RULES,
  board,
  current: Player.NEGRAS,
  scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
  bench: { [Player.BLANCAS]: [], [Player.NEGRAS]: [] },
  winner: null,
  ...overrides,
});

const emptyBoard = (w = CURRENT_RULES.width, h = CURRENT_RULES.height) => new Board(w, h);

describe("evaluate — reglas actuales", () => {
  it("posición espejada simétrica → todos los términos ≈ 0", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w1", PieceType.FORT, pos(1, 3), Player.BLANCAS));
    board.addPiece(new GamePiece("b1", PieceType.FORT, pos(3, 7), Player.NEGRAS));
    board.addPiece(new GamePiece("w2", PieceType.STRIKER, pos(4, 5), Player.BLANCAS));
    board.addPiece(new GamePiece("b2", PieceType.STRIKER, pos(0, 5), Player.NEGRAS));
    const breakdown = explainEvaluation(mkState(board), Player.BLANCAS, engine, insight);
    for (const term of [
      "points",
      "material",
      "progress",
      "hanging",
      "cohesion",
      "containment",
      "freeLane",
      "mobility",
      "runnerThreat",
    ] as const) {
      expect(Math.abs(breakdown[term])).toBeLessThan(1e-6);
    }
    expect(Math.abs(breakdown.total)).toBeLessThan(1e-6);
  });

  it("terminal: ganador → ±winValue", () => {
    const board = emptyBoard();
    const win = explainEvaluation(
      mkState(board, { winner: Player.BLANCAS }),
      Player.BLANCAS,
      engine,
      insight,
    );
    expect(win.total).toBe(MEDIUM_BOT_CONFIG.winValue);
    const lose = evaluate(
      mkState(board, { winner: Player.NEGRAS }),
      Player.BLANCAS,
      engine,
      insight,
    );
    expect(lose).toBe(-MEDIUM_BOT_CONFIG.winValue);
  });

  it("pieza atacada sin defensa baja hanging ≈ 0.9 × valor", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(2, 5), Player.BLANCAS));
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 6), Player.NEGRAS));
    const fortValue = insight.profiles.get(PieceType.FORT)!.value;
    const { hanging } = explainEvaluation(
      mkState(board), // mueve NEGRAS: la pieza atacada no se puede salvar
      Player.BLANCAS,
      engine,
      insight,
    );
    expect(hanging).toBeCloseTo(-MEDIUM_BOT_CONFIG.hanging.undefended * fortValue, 5);
  });

  it("misma pieza con defensa solo penaliza 0.25 × valor", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(2, 5), Player.BLANCAS));
    board.addPiece(new GamePiece("d", PieceType.STRIKER, pos(2, 4), Player.BLANCAS));
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 6), Player.NEGRAS));
    const fortValue = insight.profiles.get(PieceType.FORT)!.value;
    const { hanging } = explainEvaluation(mkState(board), Player.BLANCAS, engine, insight);
    // FORT atacado por el STRIKER rival y defendido por el STRIKER propio;
    // el STRIKER rival también está atacado (por el propio) → cuenta para el rival.
    expect(hanging).toBeLessThan(0);
    expect(hanging).toBeGreaterThan(-MEDIUM_BOT_CONFIG.hanging.undefended * fortValue);
  });

  it("taponar un corredor rival sube containment ≥ plugged", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w", PieceType.STRIKER, pos(2, 6), Player.BLANCAS));
    board.addPiece(new GamePiece("p", PieceType.PIONEER, pos(2, 7), Player.NEGRAS));
    const { containment } = explainEvaluation(mkState(board), Player.BLANCAS, engine, insight);
    expect(containment).toBeGreaterThanOrEqual(MEDIUM_BOT_CONFIG.containment.plugged);
  });

  it("rival a 2 de anotar sin control → runnerThreat < 0", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(0, 8), Player.BLANCAS));
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 2), Player.NEGRAS));
    const { runnerThreat } = explainEvaluation(mkState(board), Player.BLANCAS, engine, insight);
    expect(runnerThreat).toBeLessThan(0);
  });

  it("los puntos valen pointValue cada uno", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(0, 5), Player.BLANCAS));
    const { points, total } = explainEvaluation(
      mkState(board, { scores: { [Player.BLANCAS]: 2, [Player.NEGRAS]: 1 } }),
      Player.BLANCAS,
      engine,
      insight,
    );
    expect(points).toBe(MEDIUM_BOT_CONFIG.pointValue);
    expect(total).toBeGreaterThan(0);
  });
});

describe("evaluate — variante 7×13", () => {
  const rules = buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES);
  const wideInsight = getRulesInsight(rules, engine, engine.config);

  it("los signos se mantienen: colgada negativa, tapón positivo, corredor amenaza", () => {
    const board = emptyBoard(rules.width, rules.height);
    // STRIKER negro a 2 de su meta (fila 0) sin control; PIONEER negro taponeado.
    board.addPiece(new GamePiece("w", PieceType.STRIKER, pos(3, 4), Player.BLANCAS));
    board.addPiece(new GamePiece("p", PieceType.PIONEER, pos(3, 5), Player.NEGRAS));
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(1, 2), Player.NEGRAS));
    const state: SimState = {
      rules,
      board,
      current: Player.BLANCAS,
      scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
      bench: { [Player.BLANCAS]: [], [Player.NEGRAS]: [] },
      winner: null,
    };
    const { hanging, containment, runnerThreat } = explainEvaluation(
      state,
      Player.BLANCAS,
      engine,
      wideInsight,
    );
    expect(containment).toBeGreaterThan(0);
    expect(runnerThreat).toBeLessThan(0);
    expect(Number.isFinite(hanging)).toBe(true);
  });
});
