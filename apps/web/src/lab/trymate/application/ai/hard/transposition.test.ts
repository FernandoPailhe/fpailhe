import { describe, expect, it } from "vitest";
import { Bound, scoreFromTT, scoreToTT, TranspositionTable } from "./transposition";

const h = (n: number) => ({ hi: n, lo: n * 7 });

describe("TranspositionTable", () => {
  it("guarda y recupera entradas", () => {
    const tt = new TranspositionTable();
    tt.set(h(1), { depth: 3, score: 42, bound: Bound.Exact, best: null });
    expect(tt.get(h(1))?.score).toBe(42);
  });

  it("no reemplaza si la nueva entrada tiene menor profundidad", () => {
    const tt = new TranspositionTable();
    tt.set(h(1), { depth: 5, score: 10, bound: Bound.Exact, best: null });
    tt.set(h(1), { depth: 2, score: 99, bound: Bound.Exact, best: null });
    expect(tt.get(h(1))?.score).toBe(10);
    tt.set(h(1), { depth: 6, score: 99, bound: Bound.Exact, best: null });
    expect(tt.get(h(1))?.score).toBe(99);
  });

  it("respeta maxEntries y expulsa la más vieja", () => {
    const tt = new TranspositionTable(3);
    for (let i = 0; i < 5; i++) {
      tt.set(h(i), { depth: 1, score: i, bound: Bound.Exact, best: null });
    }
    expect(tt.size).toBe(3);
    expect(tt.get(h(0))).toBeUndefined();
    expect(tt.get(h(1))).toBeUndefined();
    expect(tt.get(h(4))?.score).toBe(4);
  });

  it("scoreToTT/scoreFromTT ajustan victorias por ply", () => {
    const threshold = 90_000;
    const stored = scoreToTT(100_005, 4, threshold);
    expect(scoreFromTT(stored, 4, threshold)).toBe(100_005);
    expect(scoreFromTT(stored, 1, threshold)).toBe(100_008);
    const storedLoss = scoreToTT(-100_003, 2, threshold);
    expect(scoreFromTT(storedLoss, 2, threshold)).toBe(-100_003);
    expect(scoreFromTT(scoreToTT(50, 3, threshold), 3, threshold)).toBe(50);
  });
});
