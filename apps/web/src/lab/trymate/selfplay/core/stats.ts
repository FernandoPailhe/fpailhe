/**
 * Estadística para el agregador selfplay: Wilson para proporciones, percentiles
 * por interpolación lineal, histogramas de ancho fijo. Sin dependencias.
 */

export interface Wilson {
  /** Proporción puntual. */
  p: number;
  lo: number;
  hi: number;
}

/** Intervalo de confianza de Wilson (score) para una proporción. */
export function wilson(successes: number, n: number, z = 1.96): Wilson {
  if (n <= 0) return { p: 0, lo: 0, hi: 0 };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

export function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stdev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
}

/** Percentiles por interpolación lineal (tipo 7), qs en [0,100]. */
export function percentiles(values: readonly number[], qs: readonly number[]): number[] {
  if (values.length === 0) return qs.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return qs.map((q) => {
    const rank = (q / 100) * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    const frac = rank - lo;
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac;
  });
}

export interface Histogram {
  min: number;
  /** Ancho de cada bin (0 si todos los valores son iguales). */
  step: number;
  counts: number[];
}

/** Histograma de ancho fijo sobre [min, max] de los datos. */
export function histogram(values: readonly number[], bins: number): Histogram {
  if (values.length === 0) return { min: 0, step: 0, counts: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const counts = new Array<number>(bins).fill(0);
  if (max === min) {
    counts[0] = values.length;
    return { min, step: 0, counts };
  }
  const step = (max - min) / bins;
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx]! += 1;
  }
  return { min, step, counts };
}

/** ¿Se solapan dos intervalos de confianza? */
export function overlaps(a: { lo: number; hi: number }, b: { lo: number; hi: number }): boolean {
  return a.lo <= b.hi && b.lo <= a.hi;
}
