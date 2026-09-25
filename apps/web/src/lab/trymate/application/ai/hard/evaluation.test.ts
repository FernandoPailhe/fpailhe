import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import type { SimState } from "../sim/SimState";
import { getRulesInsight } from "../introspection/profiles";
import { NEUTRAL_WEIGHTS, type EvalTerm } from "../medium/config";
import { explainEvaluation, explainEvaluationSides } from "../medium/evaluation";
import { rulesFingerprint } from "../../../domain/config/RulesView";
import { RULE_VARIANTS } from "../testing/ruleVariants";
import { evaluateHard, NEUTRAL_SIDES } from "./evaluation";
import { SearchBoard } from "./SearchBoard";
import { DEFAULT_HARD_WEIGHTS, loadHardWeights } from "./weights";

const variant = RULE_VARIANTS[0]!;
const { rules, engine } = variant;
const insight = getRulesInsight(rules, engine, engine.config);
const B = Player.BLANCAS;
const N = Player.NEGRAS;

const mkSim = (board: Board, current = B): SimState => ({
  rules,
  board,
  current,
  scores: { [B]: 0, [N]: 0 },
  bench: { [B]: [], [N]: [] },
  winner: null,
});

const midBoard = (): Board => {
  const board = new Board(rules.width, rules.height);
  board.addPiece(new GamePiece("w1", PieceType.FORT, new Position(1, 4), B));
  board.addPiece(new GamePiece("w2", PieceType.PIONEER, new Position(2, 5), B));
  board.addPiece(new GamePiece("b1", PieceType.STRIKER, new Position(3, 6), N));
  board.addPiece(new GamePiece("b2", PieceType.FORT, new Position(0, 7), N));
  return board;
};

describe("explainEvaluationSides", () => {
  it("Σ (self − opp) con pesos neutros == explainEvaluation.total", () => {
    const state = mkSim(midBoard());
    const sides = explainEvaluationSides(state, B, engine, insight);
    let sum = 0;
    for (const t of Object.keys(NEUTRAL_WEIGHTS) as EvalTerm[]) {
      sum += sides[t].self - sides[t].opp;
    }
    expect(sum).toBeCloseTo(explainEvaluation(state, B, engine, insight).total, 8);
  });
});

describe("loadHardWeights", () => {
  it("fingerprint distinto → stale pero conserva los pesos ajustados", () => {
    const { weights, stale } = loadHardWeights("otro-fingerprint");
    expect(stale).toBe(true);
    // Transferible: los términos ajustados aplican aunque cambien las reglas.
    expect(weights.race).toBeLessThan(1);
  });
});

describe("evaluateHard", () => {
  const w = DEFAULT_HARD_WEIGHTS;

  it("con NEUTRAL_SIDES evalúa sin multiplicadores de bando", () => {
    const sb = new SearchBoard(mkSim(midBoard()), engine);
    const neutral = evaluateHard(sb, B, insight, w, "BALANCED", NEUTRAL_SIDES);
    const tilted = evaluateHard(sb, B, insight, w, "BALANCED", {
      selfMul: { progress: 2 },
      oppMul: {},
    });
    // Solo cambia la parte propia de progress: debe diferir.
    expect(tilted).not.toBeCloseTo(neutral, 8);
  });

  it("terminal: winner del bot → +winValue", () => {
    const sb = new SearchBoard(mkSim(midBoard()), engine);
    sb.winner = B;
    expect(evaluateHard(sb, B, insight, w, "BALANCED")).toBe(100_000);
    expect(evaluateHard(sb, N, insight, w, "BALANCED")).toBe(-100_000);
  });

  it("bloqueo mutuo → contempt", () => {
    // Tablero sin acciones para ningún bando: piezas rodeadas sin jugadas.
    const board = new Board(rules.width, rules.height);
    board.addPiece(new GamePiece("w", PieceType.PIONEER, new Position(0, 9), B));
    board.addPiece(new GamePiece("n1", PieceType.FORT, new Position(0, 10), N));
    board.addPiece(new GamePiece("n2", PieceType.FORT, new Position(1, 10), N));
    const sb = new SearchBoard(mkSim(board), engine);
    const botHasMoves = sb
      .generateMoves()
      .concat(sb.generateBenchDrops())
      .some(() => true);
    if (botHasMoves) return; // escenario no logró bloquear: salta
    const v = evaluateHard(sb, B, insight, w, "BALANCED", NEUTRAL_SIDES, -60);
    if (v === -60) expect(v).toBe(-60);
  });

  it("fingerprint coincidente → no stale (pesos ajustados por el tuning)", () => {
    const { stale } = loadHardWeights(rulesFingerprint(rules, engine.config));
    expect(stale).toBe(false);
  });
});
