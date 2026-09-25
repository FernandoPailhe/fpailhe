import type { HardAction } from "./SearchBoard";
import { hashKey, type ZobristHash } from "./zobrist";

export enum Bound {
  Exact = 0,
  Lower = 1,
  Upper = 2,
}

export interface TTEntry {
  depth: number;
  score: number;
  bound: Bound;
  best: HardAction | null;
}

/**
 * Ajuste "mate score": los puntajes de victoria se guardan relativos a la raíz
 * para no mezclar profundidades. `threshold` = |score| a partir del cual un
 * valor cuenta como victoria (se pasa desde la config de evaluación).
 */
export const scoreToTT = (score: number, ply: number, threshold: number): number =>
  score > threshold ? score + ply : score < -threshold ? score - ply : score;

export const scoreFromTT = (score: number, ply: number, threshold: number): number =>
  score > threshold ? score - ply : score < -threshold ? score + ply : score;

/**
 * Tabla de transposición acotada. Reemplazo: entra si `depth ≥` el del actual;
 * si está llena, se borra la entrada más vieja (Map mantiene orden de inserción).
 */
export class TranspositionTable {
  private map = new Map<string, TTEntry>();

  constructor(private readonly maxEntries = 200_000) {}

  get size(): number {
    return this.map.size;
  }

  get(h: ZobristHash): TTEntry | undefined {
    if (this.maxEntries <= 0) return undefined;
    return this.map.get(hashKey(h));
  }

  set(h: ZobristHash, e: TTEntry): void {
    if (this.maxEntries <= 0) return;
    const key = hashKey(h);
    const existing = this.map.get(key);
    if (existing && e.depth < existing.depth) return;
    if (!existing && this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, e);
  }

  clear(): void {
    this.map.clear();
  }
}
