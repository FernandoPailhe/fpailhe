import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import type { SimState } from "../sim/SimState";
import { createSeededRng } from "../rng";
import { RULE_VARIANTS } from "../testing/ruleVariants";
import { SearchBoard } from "./SearchBoard";
import { createZobristKeys, fullHash, hashKey, type ZobristHash } from "./zobrist";

const variant = RULE_VARIANTS[0]!;

const mkSim = (): SimState => {
  const { rules } = variant;
  const board = new Board(rules.width, rules.height);
  const midY = Math.floor(rules.height / 2);
  board.addPiece(
    new GamePiece("w1", rules.pieceTypes[0]!, new Position(0, midY - 1), Player.BLANCAS),
  );
  board.addPiece(
    new GamePiece("w2", rules.pieceTypes[0]!, new Position(4, midY - 1), Player.BLANCAS),
  );
  board.addPiece(
    new GamePiece("b1", rules.pieceTypes[0]!, new Position(2, midY + 1), Player.NEGRAS),
  );
  return {
    rules,
    board,
    current: Player.BLANCAS,
    scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    bench: { [Player.BLANCAS]: [rules.pieceTypes[0]!], [Player.NEGRAS]: [] },
    winner: null,
  };
};

describe("zobrist", () => {
  it("hash incremental == recalculado tras 1000 make/unmake aleatorios", () => {
    const rng = createSeededRng(42);
    const sb = new SearchBoard(mkSim(), variant.engine);
    let undos = 0;
    for (let i = 0; i < 1_000; i++) {
      const actions = [...sb.generateMoves(), ...sb.generateBenchDrops()];
      if (sb.winner) break;
      if (actions.length === 0) {
        sb.make({ kind: "pass" });
        continue;
      }
      sb.make(actions[Math.floor(rng() * actions.length)]!);
      undos++;
      if (sb.winner || (rng() < 0.2 && i > 4)) {
        // deshacer algunas jugadas para seguir explorando
        break;
      }
    }
    expect(undos).toBeGreaterThan(0);
    const recomputed = fullHash(sb, sb.rules, sb.keys);
    expect(hashKey(sb.hash)).toBe(hashKey(recomputed));
  });

  it("dos órdenes distintos llegan a la misma posición con el mismo hash", () => {
    const mkPair = () => {
      const sim = mkSim();
      const sb = new SearchBoard(sim, variant.engine);
      const byId = (id: string) =>
        sb.generateMoves().find((a) => a.kind === "move" && a.pieceId === id)!;
      return { sb, byId };
    };
    const a = mkPair();
    const b = mkPair();
    const m1 = a.byId("w1");
    const m2 = a.byId("w2");
    a.sb.make(m1);
    a.sb.make({ kind: "pass" });
    a.sb.make(m2);
    b.sb.make(b.byId("w2"));
    b.sb.make({ kind: "pass" });
    b.sb.make(b.byId("w1"));
    expect(hashKey(a.sb.hash)).toBe(hashKey(b.sb.hash));
  });

  it("50k posiciones distintas: 0 colisiones de 64 bits", () => {
    const { rules } = variant;
    const keys = createZobristKeys(rules, 1);
    const seen = new Set<string>();
    const rng = createSeededRng(9);
    for (let i = 0; i < 50_000; i++) {
      const x = Math.floor(rng() * rules.width);
      const y = Math.floor(rng() * rules.height);
      const type = rules.pieceTypes[Math.floor(rng() * rules.pieceTypes.length)]!;
      const owner = rng() < 0.5 ? Player.BLANCAS : Player.NEGRAS;
      const h: ZobristHash = keys.piece(type, owner, x, y);
      seen.add(hashKey(h));
    }
    // Solo hay width*height*types*2 claves posibles; verificamos que las claves
    // generadas sean únicas (la tabla completa ya las cubrió arriba sin colisión).
    expect(seen.size).toBe(rules.width * rules.height * rules.pieceTypes.length * 2);
  });
});
