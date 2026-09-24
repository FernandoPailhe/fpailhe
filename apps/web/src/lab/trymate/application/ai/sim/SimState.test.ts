import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { GAME_RULES } from "../../../domain/constants/GameRules";
import { buildRulesView, CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import {
  applySimBench,
  applySimMove,
  generateMoves,
  opponentOf,
  passTurn,
  type SimState,
} from "./SimState";

const engine = new MovementRuleEngine();
const pos = (x: number, y: number) => new Position(x, y);

const mkState = (overrides: Partial<SimState> = {}): SimState => ({
  rules: CURRENT_RULES,
  board: new Board(CURRENT_RULES.width, CURRENT_RULES.height),
  current: Player.BLANCAS,
  scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
  bench: { [Player.BLANCAS]: [], [Player.NEGRAS]: [] },
  winner: null,
  ...overrides,
});

describe("SimState", () => {
  it("generateMoves marca capture y scores según rules.scoringRow", () => {
    const board = new Board(7, 13);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(0, 11), Player.BLANCAS));
    // STRIKER rival (sin bloqueo lateral): el STRIKER blanco lo captura de
    // frente en la fila de anotación y también puede entrar en diagonal.
    board.addPiece(new GamePiece("e", PieceType.STRIKER, pos(0, 12), Player.NEGRAS));
    const rules = buildRulesView(
      { BOARD_WIDTH: 7, BOARD_HEIGHT: 13 },
      { ...GAME_RULES, POINTS_TO_WIN: 2 },
    );
    const state = mkState({ rules, board });
    const moves = generateMoves(state, engine);
    const capMove = moves.find((m) => m.to.y === 12 && m.to.x === 0);
    const diagMove = moves.find((m) => m.to.y === 12 && m.to.x === 1);
    expect(capMove?.capture).toBe(PieceType.STRIKER); // captura de frente en fila 12
    expect(capMove?.scores).toBe(true);
    expect(diagMove?.scores).toBe(true);
    expect(diagMove?.capture).toBeUndefined();
  });

  it("applySimMove anota, retira la pieza, suma y fija winner; sin mutar", () => {
    const rules = buildRulesView(
      { BOARD_WIDTH: 7, BOARD_HEIGHT: 13 },
      { ...GAME_RULES, POINTS_TO_WIN: 2 },
    );
    const board = new Board(7, 13);
    board.addPiece(new GamePiece("s1", PieceType.STRIKER, pos(0, 11), Player.BLANCAS));
    board.addPiece(new GamePiece("s2", PieceType.STRIKER, pos(2, 11), Player.BLANCAS));
    board.addPiece(new GamePiece("n", PieceType.STRIKER, pos(4, 9), Player.NEGRAS));
    const state = mkState({ rules, board });
    const before = state.board.getAllPieces().length;

    // Blancas anota en fila 12.
    const m1 = generateMoves(state, engine).find((m) => m.pieceId === "s1" && m.to.y === 12)!;
    const next = applySimMove(state, m1);
    expect(next.scores[Player.BLANCAS]).toBe(1);
    expect(next.board.getPieceById("s1")).toBeUndefined(); // anotó y salió
    expect(next.current).toBe(Player.NEGRAS);
    expect(next.winner).toBeNull();
    expect(state.board.getAllPieces().length).toBe(before); // inmutable

    // Negras mueve sin anotar.
    const m2 = generateMoves(next, engine).find((m) => m.pieceId === "n")!;
    const next2 = applySimMove(next, m2);
    expect(next2.scores[Player.NEGRAS]).toBe(0);
    expect(next2.current).toBe(Player.BLANCAS);

    // Segundo punto de Blancas → winner.
    const m3 = generateMoves(next2, engine).find((m) => m.pieceId === "s2" && m.to.y === 12)!;
    const end = applySimMove(next2, m3);
    expect(end.scores[Player.BLANCAS]).toBe(2);
    expect(end.winner).toBe(Player.BLANCAS);
  });

  it("applySimBench agrega la pieza y no cambia el turno", () => {
    const board = new Board(5, 11);
    const state = mkState({
      board,
      bench: { [Player.BLANCAS]: [PieceType.FORT], [Player.NEGRAS]: [] },
    });
    const next = applySimBench(state, PieceType.FORT, pos(0, 1), "b1");
    expect(next.board.getPieceById("b1")?.position?.equals(pos(0, 1))).toBe(true);
    expect(next.bench[Player.BLANCAS]).toHaveLength(0);
    expect(next.current).toBe(Player.BLANCAS);
    expect(state.board.getPieceById("b1")).toBeUndefined();
  });

  it("applySimBench lanza fuera de las filas de despliegue o con tablero lleno", () => {
    const board = new Board(5, 11);
    const state = mkState({
      board,
      bench: { [Player.BLANCAS]: [PieceType.FORT], [Player.NEGRAS]: [] },
    });
    expect(() => applySimBench(state, PieceType.FORT, pos(0, 5), "b1")).toThrow();

    const full = new Board(5, 11);
    for (let i = 0; i < CURRENT_RULES.piecesToPlace; i++) {
      full.addPiece(new GamePiece(`p${i}`, PieceType.FORT, pos(i, 1), Player.BLANCAS));
    }
    const fullState = mkState({
      board: full,
      bench: { [Player.BLANCAS]: [PieceType.FORT], [Player.NEGRAS]: [] },
    });
    expect(() => applySimBench(fullState, PieceType.FORT, pos(0, 2), "b1")).toThrow();
  });

  it("applySimBench lanza si el tipo no está en la banca", () => {
    const state = mkState({
      bench: { [Player.BLANCAS]: [PieceType.STRIKER], [Player.NEGRAS]: [] },
    });
    expect(() => applySimBench(state, PieceType.FORT, pos(0, 1), "b1")).toThrow();
  });

  it("passTurn y opponentOf alternan el turno", () => {
    const state = mkState();
    expect(opponentOf(Player.BLANCAS)).toBe(Player.NEGRAS);
    expect(passTurn(state).current).toBe(Player.NEGRAS);
  });
});
