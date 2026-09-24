import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import { getRulesInsight } from "../introspection/profiles";
import { createSeededRng } from "../rng";
import type { SimState } from "../sim/SimState";
import { NEUTRAL_WEIGHTS } from "./config";
import { chooseBenchPlacement } from "./benchPlacement";

const engine = new MovementRuleEngine();
const insight = getRulesInsight(CURRENT_RULES, engine, engine.config);
const pos = (x: number, y: number) => new Position(x, y);
const BOT = Player.NEGRAS;
const HUMAN = Player.BLANCAS;
const rng = () => 0.5;

const mkState = (board: Board, bench: PieceType[]): SimState => ({
  rules: CURRENT_RULES,
  board,
  current: BOT,
  scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
  bench: { [Player.BLANCAS]: [], [Player.NEGRAS]: bench },
  winner: null,
});

const empty = () => new Board(CURRENT_RULES.width, CURRENT_RULES.height);
const choose = (state: SimState, r: () => number = rng) =>
  chooseBenchPlacement(state, BOT, engine, insight, NEUTRAL_WEIGHTS, r);

describe("chooseBenchPlacement — casos nulos", () => {
  it("null con banca vacía", () => {
    expect(choose(mkState(empty(), []))).toBeNull();
  });

  it("null con tablero lleno (piecesToPlace propias)", () => {
    const board = empty();
    for (let i = 0; i < CURRENT_RULES.piecesToPlace; i++) {
      board.addPiece(new GamePiece(`n${i}`, PieceType.FORT, pos(i, 9), BOT));
    }
    expect(choose(mkState(board, [PieceType.FORT]))).toBeNull();
  });

  it("null sin casillas válidas (filas ocupadas por el rival)", () => {
    const board = empty();
    for (const row of CURRENT_RULES.placementRows(BOT)) {
      for (let x = 0; x < CURRENT_RULES.width; x++) {
        board.addPiece(new GamePiece(`w${x}-${row}`, PieceType.FORT, pos(x, row), HUMAN));
      }
    }
    expect(choose(mkState(board, [PieceType.FORT]))).toBeNull();
  });
});

describe("chooseBenchPlacement — reglas actuales", () => {
  it("siempre baja si puede: devuelve tipo de la banca y casilla válida", () => {
    const board = empty();
    const state = mkState(board, [PieceType.FORT, PieceType.STRIKER]);
    const choice = choose(state);
    expect(choice).not.toBeNull();
    expect(state.bench[BOT]).toContain(choice!.type);
    const squares = getBenchPlacementSquares(board, BOT, CURRENT_RULES);
    expect(squares.some((s) => s.equals(choice!.to))).toBe(true);
  });

  it("evita casillas atacadas por el rival", () => {
    const board = empty();
    // STRIKER blanco captura recto hacia adelante: ataca (2,7), casilla de
    // despliegue del bot. Cualquier otra casilla vale más (≈ −14 por colgar).
    board.addPiece(new GamePiece("w", PieceType.STRIKER, pos(2, 6), HUMAN));
    const choice = choose(mkState(board, [PieceType.FORT]));
    expect(choice).not.toBeNull();
    expect(choice!.to.equals(pos(2, 7))).toBe(false);
  });

  it("prefiere bajar junto a una pieza propia (apoyo, no aislada)", () => {
    const board = empty();
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(1, 8), BOT));
    const choice = choose(mkState(board, [PieceType.FORT]));
    expect(choice).not.toBeNull();
    // Dentro del radio de apoyo de la FORT existente.
    const chebyshev = Math.max(Math.abs(choice!.to.x - 1), Math.abs(choice!.to.y - 8));
    expect(chebyshev).toBeLessThanOrEqual(insight.geometry.supportRadius);
  });

  it("determinista con el mismo rng sembrado", () => {
    const board = empty();
    board.addPiece(new GamePiece("f", PieceType.FORT, pos(1, 8), BOT));
    const state = mkState(board, [PieceType.FORT, PieceType.STRIKER]);
    const a = choose(state, createSeededRng(11));
    const b = choose(state, createSeededRng(11));
    expect(a!.type).toBe(b!.type);
    expect(a!.to.equals(b!.to)).toBe(true);
  });
});
