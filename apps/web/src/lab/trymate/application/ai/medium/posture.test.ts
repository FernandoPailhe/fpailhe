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
import { choosePosture, weightsFor } from "./posture";
import { NEUTRAL_WEIGHTS } from "./config";

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

const BOT = Player.NEGRAS;
const HUMAN = Player.BLANCAS;
const board = (w = CURRENT_RULES.width, h = CURRENT_RULES.height) => new Board(w, h);

describe("choosePosture — reglas actuales", () => {
  it("rival a runnerZone de anotar sin control → DEFEND aunque el bot tenga carril libre", () => {
    const b = board();
    b.addPiece(new GamePiece("t", PieceType.STRIKER, pos(2, 7), HUMAN)); // d = 3, suelto
    // Corredor propio con carril libre a 1 de la meta (tentación de ATTACK).
    b.addPiece(new GamePiece("p", PieceType.PIONEER, pos(0, 1), BOT));
    expect(choosePosture(mkState(b), BOT, engine, insight)).toBe("DEFEND");
  });

  it("corredor rival con todos sus avances atacados → no DEFEND", () => {
    const b = board();
    // STRIKER blanco en (2,7) avanza a (1,8),(2,8),(3,8); su carga a (2,9)
    // queda ocupada por el bot. FORTs negros cubren todas las casillas.
    b.addPiece(new GamePiece("t", PieceType.STRIKER, pos(2, 7), HUMAN));
    b.addPiece(new GamePiece("f1", PieceType.FORT, pos(1, 9), BOT)); // ataca (0,8),(2,8)
    b.addPiece(new GamePiece("f2", PieceType.FORT, pos(2, 9), BOT)); // ataca (1,8),(3,8)
    expect(choosePosture(mkState(b), BOT, engine, insight)).not.toBe("DEFEND");
  });

  it("corredor propio con carril libre a runnerZone+1 → ATTACK", () => {
    const b = board();
    b.addPiece(new GamePiece("p", PieceType.PIONEER, pos(2, 4), BOT)); // d = 4, libre
    b.addPiece(new GamePiece("e", PieceType.FORT, pos(4, 1), HUMAN)); // lejos de su meta
    expect(choosePosture(mkState(b), BOT, engine, insight)).toBe("ATTACK");
  });

  it("al rival le falta un punto → DEFEND", () => {
    const b = board();
    b.addPiece(new GamePiece("p", PieceType.PIONEER, pos(2, 6), BOT));
    b.addPiece(new GamePiece("e", PieceType.FORT, pos(4, 8), HUMAN));
    const state = mkState(b, {
      scores: { [Player.BLANCAS]: CURRENT_RULES.pointsToWin - 1, [Player.NEGRAS]: 0 },
    });
    expect(choosePosture(state, BOT, engine, insight)).toBe("DEFEND");
  });

  it("posición inicial espejada → BALANCED", () => {
    const b = board();
    const back = [
      PieceType.FORT,
      PieceType.STRIKER,
      PieceType.PIONEER,
      PieceType.FORT,
      PieceType.STRIKER,
    ];
    back.forEach((type, x) => {
      b.addPiece(new GamePiece(`w${x}`, type, pos(x, 2), HUMAN));
      b.addPiece(new GamePiece(`n${x}`, type, pos(CURRENT_RULES.width - 1 - x, 8), BOT));
    });
    expect(choosePosture(mkState(b), BOT, engine, insight)).toBe("BALANCED");
  });
});

describe("choosePosture — variante 7×13", () => {
  const rules = buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES);
  const wideInsight = getRulesInsight(rules, engine, engine.config);
  const wideState = (b: Board): SimState => ({
    rules,
    board: b,
    current: Player.NEGRAS,
    scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    bench: { [Player.BLANCAS]: [], [Player.NEGRAS]: [] },
    winner: null,
  });

  it("rival a runnerZone (4) → DEFEND; a 6 → no DEFEND", () => {
    const b = board(rules.width, rules.height);
    b.addPiece(new GamePiece("t", PieceType.STRIKER, pos(3, 8), HUMAN)); // d = 4 = runnerZone
    b.addPiece(new GamePiece("p", PieceType.PIONEER, pos(0, 11), BOT));
    expect(choosePosture(wideState(b), BOT, engine, wideInsight)).toBe("DEFEND");

    const b2 = board(rules.width, rules.height);
    b2.addPiece(new GamePiece("t", PieceType.STRIKER, pos(3, 6), HUMAN)); // d = 6 > 4
    b2.addPiece(new GamePiece("p", PieceType.PIONEER, pos(0, 11), BOT));
    expect(choosePosture(wideState(b2), BOT, engine, wideInsight)).not.toBe("DEFEND");
  });
});

describe("weightsFor", () => {
  it("BALANCED devuelve los pesos neutrales", () => {
    expect(weightsFor("BALANCED")).toEqual(NEUTRAL_WEIGHTS);
  });
  it("DEFEND sube contención y amenaza, baja progreso", () => {
    const w = weightsFor("DEFEND");
    expect(w.containment).toBeGreaterThan(1);
    expect(w.runnerThreat).toBeGreaterThan(1);
    expect(w.progress).toBeLessThan(1);
  });
});
