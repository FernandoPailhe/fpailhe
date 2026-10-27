/** RNG determinista (mulberry32) para tests, simulaciones y QA. */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generador de ids secuenciales para tests/simulación: "id_1", "id_2", … */
export function createSequentialId(prefix = "id"): () => string {
  let n = 0;
  return () => `${prefix}_${++n}`;
}
