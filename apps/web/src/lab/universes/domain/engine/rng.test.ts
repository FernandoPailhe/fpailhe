import { describe, expect, it } from "vitest";
import { createSeededRng, createSequentialId } from "./rng";

describe("createSeededRng", () => {
  it("es determinista: misma semilla → misma secuencia", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it("distinta semilla → distinta secuencia", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("produce valores en [0, 1)", () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("createSequentialId", () => {
  it("genera ids únicos y secuenciales con prefijo", () => {
    const newId = createSequentialId("x");
    expect(newId()).toBe("x_1");
    expect(newId()).toBe("x_2");
  });
});
