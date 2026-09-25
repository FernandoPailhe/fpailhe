import { describe, expect, it } from "vitest";
import { histogram, mean, overlaps, percentiles, stdev, wilson } from "./stats";

describe("stats", () => {
  it("wilson(50, 100) ≈ { p: 0.5, lo: 0.404, hi: 0.596 }", () => {
    const w = wilson(50, 100);
    expect(w.p).toBeCloseTo(0.5, 6);
    expect(w.lo).toBeCloseTo(0.404, 3);
    expect(w.hi).toBeCloseTo(0.596, 3);
  });

  it("wilson: bordes y n=0", () => {
    expect(wilson(0, 0)).toEqual({ p: 0, lo: 0, hi: 0 });
    const all = wilson(100, 100);
    expect(all.p).toBe(1);
    expect(all.hi).toBeCloseTo(1, 10);
    expect(all.lo).toBeGreaterThan(0.9);
    const none = wilson(0, 100);
    expect(none.p).toBe(0);
    expect(none.lo).toBe(0);
    expect(none.hi).toBeLessThan(0.1);
  });

  it("mean / stdev", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
    expect(stdev([2, 4, 6])).toBeCloseTo(2, 6);
    expect(stdev([5])).toBe(0);
  });

  it("percentiles: interpolación lineal", () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(percentiles(xs, [0, 50, 100])).toEqual([0, 4.5, 9]);
    expect(percentiles([], [50])).toEqual([0]);
  });

  it("histogram: bins de ancho fijo y caso degenerado", () => {
    const h = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
    expect(h.counts).toEqual([2, 2, 2, 2, 2]);
    expect(h.min).toBe(0);
    expect(h.step).toBeCloseTo(1.8, 6);
    const flat = histogram([7, 7, 7], 4);
    expect(flat.counts).toEqual([3, 0, 0, 0]);
    expect(histogram([], 3).counts).toEqual([]);
  });

  it("overlaps", () => {
    expect(overlaps({ lo: 0.4, hi: 0.6 }, { lo: 0.55, hi: 0.7 })).toBe(true);
    expect(overlaps({ lo: 0.4, hi: 0.5 }, { lo: 0.6, hi: 0.7 })).toBe(false);
  });
});
