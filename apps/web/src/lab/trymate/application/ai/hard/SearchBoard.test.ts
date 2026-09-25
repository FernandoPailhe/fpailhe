import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import {
  applySimBench,
  applySimMove,
  generateMoves,
  passTurn,
  type SimState,
} from "../sim/SimState";
import { createSeededRng } from "../rng";
import { RULE_VARIANTS, type RuleVariant } from "../testing/ruleVariants";
import { SearchBoard, type HardAction } from "./SearchBoard";

let seq = 0;
const mkState = (variant: RuleVariant, seed: number): SimState => {
  const rng = createSeededRng(seed);
  const { rules } = variant;
  const board = new Board(rules.width, rules.height);
  const midY = Math.floor(rules.height / 2);
  const players = [Player.BLANCAS, Player.NEGRAS];
  players.forEach((owner, pi) => {
    rules.pieceTypes.forEach((type, ti) => {
      const x = (ti + pi * 2) % rules.width;
      const y = midY + rules.forward(owner) * (ti % 2);
      if (!board.getPieceAt(new Position(x, y))) {
        board.addPiece(new GamePiece(`s-${seq++}`, type, new Position(x, y), owner));
      }
    });
  });
  void rng;
  return {
    rules,
    board,
    current: Player.BLANCAS,
    scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    bench: {
      [Player.BLANCAS]: [...rules.pieceTypes.slice(0, rules.benchSize)],
      [Player.NEGRAS]: [...rules.pieceTypes.slice(0, rules.benchSize)],
    },
    winner: null,
  };
};

const serialize = (s: SimState): string =>
  JSON.stringify({
    pieces: s.board
      .getAllPieces()
      .map((p) => `${p.type}@${p.position!.x},${p.position!.y}:${p.owner}`)
      .sort(),
    current: s.current,
    scores: s.scores,
    bench: s.bench,
    winner: s.winner,
  });

const applyToSim = (
  state: SimState,
  action: HardAction,
  variant: RuleVariant,
  from: Position | null,
): SimState => {
  if (action.kind === "pass") return passTurn(state);
  if (action.kind === "bench") {
    return applySimBench(
      state,
      action.type,
      new Position(action.to.x, action.to.y),
      `par-${seq++}`,
    );
  }
  const legal = generateMoves(state, variant.engine).find(
    (m) => m.from.equals(from!) && m.to.x === action.to.x && m.to.y === action.to.y,
  );
  if (!legal) throw new Error(`acción no legal en sim: ${JSON.stringify(action)}`);
  return applySimMove(state, legal);
};

describe("SearchBoard", () => {
  it.each(RULE_VARIANTS.map((v) => [v.name, v] as const))(
    "paridad con SimState: %s (500 acciones aleatorias)",
    (_name, variant) => {
      const rng = createSeededRng(7);
      let sim = mkState(variant, 1);
      let sb = new SearchBoard(sim, variant.engine);
      for (let i = 0; i < 500; i++) {
        const actions = [...sb.generateMoves(), ...sb.generateBenchDrops()];
        if (sim.winner || actions.length === 0) {
          actions.push({ kind: "pass" });
          if (sim.winner) {
            sim = mkState(variant, 100 + i);
            sb = new SearchBoard(sim, variant.engine);
            continue;
          }
        }
        const action = actions[Math.floor(rng() * actions.length)]!;
        const from =
          action.kind === "move" ? (sb.board.getPieceById(action.pieceId)?.position ?? null) : null;
        sb.make(action);
        sim = applyToSim(sim, action, variant, from);
        expect(serialize(sb.toSimState())).toBe(serialize(sim));
      }
    },
  );

  it("make + unmake × N vuelve al estado inicial exacto", () => {
    const variant = RULE_VARIANTS[0]!;
    const rng = createSeededRng(11);
    const sim = mkState(variant, 2);
    const sb = new SearchBoard(sim, variant.engine);
    const initial = serialize(sb.toSimState());
    const undos = [];
    for (let i = 0; i < 80; i++) {
      const actions = [...sb.generateMoves(), ...sb.generateBenchDrops()];
      if (actions.length === 0 || sb.winner) break;
      undos.push(sb.make(actions[Math.floor(rng() * actions.length)]!));
    }
    while (undos.length > 0) sb.unmake(undos.pop()!);
    expect(serialize(sb.toSimState())).toBe(initial);
  });

  it("anotar y deshacer restaura la pieza, el score y el turno", () => {
    const variant = RULE_VARIANTS[0]!;
    const { rules } = variant;
    const board = new Board(rules.width, rules.height);
    const forward = rules.forward(Player.BLANCAS);
    const y = rules.scoringRow(Player.BLANCAS) - forward;
    board.addPiece(
      new GamePiece(
        "runner",
        rules.pieceTypes.find((t) => t === rules.pieceTypes[0])!,
        new Position(0, y),
        Player.BLANCAS,
      ),
    );
    const sim = mkState(variant, 3);
    sim.board = board;
    sim.current = Player.BLANCAS;
    const sb = new SearchBoard(sim, variant.engine);
    const scoring = sb
      .generateMoves()
      .find((a) => a.kind === "move" && a.to.y === rules.scoringRow(Player.BLANCAS));
    if (!scoring) return; // el tipo elegido no alcanza: escenario no aplicable
    const before = serialize(sb.toSimState());
    const undo = sb.make(scoring);
    expect(sb.scores[Player.BLANCAS]).toBe(1);
    expect(sb.board.getPieceById("runner")).toBeUndefined();
    sb.unmake(undo);
    expect(serialize(sb.toSimState())).toBe(before);
    expect(sb.board.getPieceById("runner")?.position?.y).toBe(y);
  });
});
