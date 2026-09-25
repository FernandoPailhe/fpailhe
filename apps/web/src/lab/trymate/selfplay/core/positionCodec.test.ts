import { describe, expect, it } from "vitest";
import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { CURRENT_RULES, type RulesView } from "../../domain/config/RulesView";
import type { SimState } from "../../application/ai/sim/SimState";
import { createSeededRng, type Rng } from "../../application/ai/rng";
import { RULE_VARIANTS } from "../../application/ai/testing/ruleVariants";
import { decodePosition, encodePosition } from "./positionCodec";

const { BLANCAS, NEGRAS } = Player;

/** Posición aleatoria: k piezas en casillas únicas, bancas y puntajes al azar. */
function randomSim(rules: RulesView, rng: Rng): SimState {
  const board = new Board(rules.width, rules.height);
  const used = new Set<string>();
  const count = 1 + Math.floor(rng() * Math.min(12, rules.width * rules.height - 1));
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    do {
      x = Math.floor(rng() * rules.width);
      y = Math.floor(rng() * rules.height);
    } while (used.has(`${x},${y}`));
    used.add(`${x},${y}`);
    const type = rules.pieceTypes[Math.floor(rng() * rules.pieceTypes.length)]!;
    const owner = rng() < 0.5 ? BLANCAS : NEGRAS;
    board.addPiece(new GamePiece(`p${i}`, type, new Position(x, y), owner));
  }
  const benchOf = () => {
    const n = Math.floor(rng() * (rules.benchSize + 1));
    return Array.from(
      { length: n },
      () => rules.pieceTypes[Math.floor(rng() * rules.pieceTypes.length)]!,
    );
  };
  return {
    rules,
    board,
    current: rng() < 0.5 ? BLANCAS : NEGRAS,
    scores: {
      [BLANCAS]: Math.floor(rng() * rules.pointsToWin),
      [NEGRAS]: Math.floor(rng() * rules.pointsToWin),
    },
    bench: { [BLANCAS]: benchOf(), [NEGRAS]: benchOf() },
    winner: null,
  };
}

describe("positionCodec", () => {
  it("encode → decode → encode es idéntico en 500 posiciones aleatorias (reglas actuales)", () => {
    const rng = createSeededRng(11);
    for (let i = 0; i < 500; i++) {
      const sim = randomSim(CURRENT_RULES, rng);
      const code = encodePosition(sim);
      expect(encodePosition(decodePosition(code, CURRENT_RULES))).toBe(code);
    }
  });

  it("idem en la variante 7×13 (independiente del tamaño)", () => {
    const wide = RULE_VARIANTS.find((v) => v.name === "wide-7x13")!;
    const rng = createSeededRng(22);
    for (let i = 0; i < 500; i++) {
      const sim = randomSim(wide.rules, rng);
      const code = encodePosition(sim);
      expect(encodePosition(decodePosition(code, wide.rules))).toBe(code);
    }
  });

  it("decode reproduce el estado: current, scores, bancas y piezas", () => {
    const rules = CURRENT_RULES;
    const board = new Board(rules.width, rules.height);
    board.addPiece(new GamePiece("a", PieceType.FORT, new Position(1, 5), NEGRAS));
    board.addPiece(new GamePiece("b", PieceType.STRIKER, new Position(2, 2), BLANCAS));
    const sim: SimState = {
      rules,
      board,
      current: NEGRAS,
      scores: { [BLANCAS]: 1, [NEGRAS]: 0 },
      bench: { [BLANCAS]: [PieceType.PIONEER, PieceType.STRIKER], [NEGRAS]: [PieceType.FORT] },
      winner: null,
    };
    const back = decodePosition(encodePosition(sim), rules);
    expect(back.current).toBe(NEGRAS);
    expect(back.scores[BLANCAS]).toBe(1);
    expect(back.scores[NEGRAS]).toBe(0);
    expect(back.bench[BLANCAS]).toEqual([PieceType.PIONEER, PieceType.STRIKER]);
    expect(back.bench[NEGRAS]).toEqual([PieceType.FORT]);
    const pieces = back.board.getAllPieces();
    expect(pieces).toHaveLength(2);
    const fort = pieces.find((p) => p.type === PieceType.FORT)!;
    expect(fort.owner).toBe(NEGRAS);
    expect(fort.position!.x).toBe(1);
    expect(fort.position!.y).toBe(5);
  });

  it("posición típica de mitad de partida ≤ 80 caracteres", () => {
    const rules = CURRENT_RULES;
    const board = new Board(rules.width, rules.height);
    const pieces: [PieceType, Player, number, number][] = [
      [PieceType.FORT, BLANCAS, 0, 2],
      [PieceType.STRIKER, BLANCAS, 2, 3],
      [PieceType.PIONEER, BLANCAS, 4, 4],
      [PieceType.FORT, NEGRAS, 1, 8],
      [PieceType.STRIKER, NEGRAS, 3, 7],
      [PieceType.PIONEER, NEGRAS, 4, 6],
      [PieceType.STRIKER, BLANCAS, 1, 5],
      [PieceType.FORT, NEGRAS, 4, 9],
    ];
    for (const [i, [t, o, x, y]] of pieces.entries()) {
      board.addPiece(new GamePiece(`p${i}`, t, new Position(x, y), o));
    }
    const sim: SimState = {
      rules,
      board,
      current: BLANCAS,
      scores: { [BLANCAS]: 0, [NEGRAS]: 0 },
      bench: { [BLANCAS]: [PieceType.FORT], [NEGRAS]: [PieceType.PIONEER, PieceType.STRIKER] },
      winner: null,
    };
    const code = encodePosition(sim);
    expect(code.length).toBeLessThanOrEqual(80);
  });

  it("rechaza códigos malformados con error claro", () => {
    const rules = CURRENT_RULES;
    expect(() => decodePosition("b|0,0", rules)).toThrow(/formato inválido/);
    expect(() => decodePosition("x|0,0|||", rules)).toThrow(/current/);
    expect(() => decodePosition("b|a,0|||", rules)).toThrow(/scores/);
    expect(() => decodePosition("b|0,0|||0b9.9", rules)).toThrow(/fuera del tablero/);
    expect(() => decodePosition("b|0,0|9||", rules)).toThrow(/fuera de rango/);
  });
});
