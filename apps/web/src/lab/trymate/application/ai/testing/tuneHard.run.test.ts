import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HARD_TERMS, type HardTerm } from "../hard/weights";
import {
  DEFAULT_TUNE_OPTIONS,
  runSpsa,
  tuneHardWeights,
  validateWeights,
  weightsFilePayload,
  type MatchFn,
} from "./tuneHard";
import { RULE_VARIANTS } from "./ruleVariants";
import { createMediumBot } from "../MediumBot";
import { createSeededRng } from "../rng";
import type { RuleVariant } from "./ruleVariants";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEIGHTS_PATH = join(HERE, "../hard/weights.json");
const CHECKPOINT_PATH = join(HERE, "../hard/weights.tune.checkpoint.json");

const all = (v: number): Record<HardTerm, number> =>
  Object.fromEntries(HARD_TERMS.map((t) => [t, v])) as Record<HardTerm, number>;

const logDist = (a: Record<HardTerm, number>, b: Record<HardTerm, number>): number =>
  HARD_TERMS.reduce((s, t) => s + Math.abs(Math.log(a[t]) - Math.log(b[t])), 0);

describe("tuneHard — núcleo SPSA", () => {
  it("converge hacia el óptimo conocido con una arena falsa determinista", async () => {
    const start = all(1);
    // Óptimo escondido: algunos términos valen más, otros menos.
    const optimum = all(1);
    HARD_TERMS.forEach((t, i) => {
      optimum[t] = Math.exp(((i % 5) - 2) * 0.6);
    });
    const play: MatchFn = (wPlus, wMinus) =>
      logDist(wPlus, optimum) <= logDist(wMinus, optimum) ? "plus" : "minus";

    const tuned = await runSpsa(
      start,
      { iterations: 50, gamesPerIteration: 1, nodesPerMove: 0, seed: 7, a: 0.5, c: 0.1 },
      play,
    );

    expect(logDist(tuned, optimum)).toBeLessThan(logDist(start, optimum));
    // Convergencia real: más de la mitad del camino recorrido.
    expect(logDist(tuned, optimum)).toBeLessThan(logDist(start, optimum) * 0.5);
    for (const t of HARD_TERMS) expect(tuned[t]).toBeGreaterThan(0);
  });
});

// ── Entrada real (solo manual): TRYMATE_TUNE=1 pnpm exec vitest run … ──
// Smoke por defecto (5 iteraciones); TRYMATE_TUNE_ITERS / _GAMES / _NODES
// escalan la corrida completa (defaults del spec: 200 × 8 × 4000).

const RUN = process.env.TRYMATE_TUNE === "1";
const env = (k: string, d: number): number => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : d;
};

/** Punto de partida: NEUTRAL por defecto; TRYMATE_TUNE_START='{"race":0.5}' para warm-start. */
const startWeights = (): Record<HardTerm, number> => {
  const w = all(1);
  const raw = process.env.TRYMATE_TUNE_START;
  if (raw) {
    const over = JSON.parse(raw) as Partial<Record<HardTerm, number>>;
    for (const t of HARD_TERMS) if (typeof over[t] === "number") w[t] = over[t]!;
  }
  return w;
};

describe.skipIf(!RUN)("tuneHard — corrida SPSA real", () => {
  it(
    "ajusta pesos por auto-juego y escribe weights.json solo si valida",
    async () => {
      const variant = RULE_VARIANTS[0]!;
      const start = startWeights();
      // La validación siempre mide contra los defaults NEUTRAL que se
      // shipean: solo se escribe weights.json si el resultado los supera.
      const baseline = all(1);
      const opts = {
        ...DEFAULT_TUNE_OPTIONS,
        iterations: env("TRYMATE_TUNE_ITERS", 5),
        gamesPerIteration: env("TRYMATE_TUNE_GAMES", 2),
        nodesPerMove: env("TRYMATE_TUNE_NODES", 1_500),
        seed: env("TRYMATE_TUNE_SEED", 1),
      };
      // TRYMATE_TUNE_OPP=medium → tuning y validación contra Medium fijo
      // (el objetivo real de los umbrales del plan) en vez de auto-juego.
      const reference =
        process.env.TRYMATE_TUNE_OPP === "medium"
          ? (variant: RuleVariant, seed: number) => createMediumBot(createSeededRng(seed))
          : undefined;
      if (reference) opts.reference = reference;

      const tuned = await tuneHardWeights(start, variant, opts, (it, w) => {
        writeFileSync(CHECKPOINT_PATH, JSON.stringify(weightsFilePayload(w, variant, it), null, 2));
        console.warn(`[tune] iteración ${it}/${opts.iterations} → checkpoint`);
      });

      const validationGames = env("TRYMATE_TUNE_VALIDATE_GAMES", 40);
      const res = await validateWeights(
        tuned,
        baseline,
        variant,
        validationGames,
        opts.nodesPerMove,
        opts.seed + 999,
        "balanced",
        "balanced",
        reference,
      );
      const winRate = res.wins / validationGames;
      console.warn(
        `[tune] validación ${validationGames} partidas: ${res.wins}–${res.losses}–${res.draws} ` +
          `(${Math.round(winRate * 100)}%), ilegales=${res.illegal}`,
      );

      // Paridad de personalidades vs balanced (reporte; ajuste manual si sale).
      for (const p of ["offensive", "defensive"] as const) {
        const par = await validateWeights(
          tuned,
          tuned,
          variant,
          validationGames,
          opts.nodesPerMove,
          opts.seed + 555,
          p,
          "balanced",
        );
        const pr = par.wins / validationGames;
        const ok = pr >= 0.4 && pr <= 0.6;
        console.warn(
          `[tune] paridad ${p}: ${Math.round(pr * 100)}% ${ok ? "OK" : "FUERA de 40–60% — ajustar personalities.ts"}`,
        );
      }

      if (res.illegal === 0 && winRate >= 0.55) {
        writeFileSync(
          WEIGHTS_PATH,
          JSON.stringify(weightsFilePayload(tuned, variant, validationGames), null, 2),
        );
        console.warn("[tune] weights.json actualizado (≥55%)");
      } else {
        console.warn("[tune] NO se escribió weights.json (win-rate <55% o ilegales)");
      }
    },
    env("TRYMATE_TUNE_TIMEOUT_MIN", 30) * 60_000,
  );
});
