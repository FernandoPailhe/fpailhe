import { Player } from "../../../domain/constants/PieceConstants";
import { rulesFingerprint } from "../../../domain/config/RulesView";
import { playArenaGame } from "../arena";
import type { BotContext, ComputerPlayer } from "../ComputerPlayer";
import { getRulesInsight } from "../introspection/profiles";
import { chooseBenchType, chooseSetupPlacement, targetComposition } from "../medium/setupStrategy";
import type { Personality } from "../personality";
import { createSeededRng, type Rng } from "../rng";
import { simFromContext } from "../sim/SimState";
import { toBotPlayAction } from "../hard/botAction";
import { getPersonalityProfile } from "../hard/personalities";
import { SearchBoard } from "../hard/SearchBoard";
import { searchHard } from "../hard/search";
import { HARD_TERMS, type HardTerm } from "../hard/weights";
import { TranspositionTable } from "../hard/transposition";
import type { RuleVariant } from "./ruleVariants";

/**
 * Ajuste SPSA de los pesos de evaluación de Hard por auto-juego.
 * Herramienta de dev: no se importa desde código de aplicación (ver
 * verificación del task). Todo opera en espacio log para que los pesos
 * queden estrictamente positivos.
 */

export interface TuneOptions {
  iterations: number;
  gamesPerIteration: number;
  nodesPerMove: number;
  seed: number;
  /** Paso de gradiente: a_k = a / (k + 1 + 10)^0.602. */
  a: number;
  /** Magnitud de perturbación: c_k = c / (k + 1)^0.101. */
  c: number;
  /**
   * Rival de referencia fijo (p.ej. Medium). Si se da, w+ y w− juegan cada
   * una una partida contra él con la misma semilla y el mismo color
   * (comparación pareada) en vez de enfrentarse entre sí: el gradiente
   * mide quién rinde mejor contra el objetivo real.
   */
  reference?: (variant: RuleVariant, seed: number) => ComputerPlayer;
}

export const DEFAULT_TUNE_OPTIONS: TuneOptions = {
  iterations: 200,
  gamesPerIteration: 8,
  nodesPerMove: 4_000,
  seed: 1,
  a: 0.5,
  c: 0.1,
};

export type SpsaOutcome = "plus" | "minus" | "draw";

/** Juega una partida entre los pesos perturbados; devuelve quién ganó. */
export type MatchFn = (
  wPlus: Record<HardTerm, number>,
  wMinus: Record<HardTerm, number>,
  gameIndex: number,
) => SpsaOutcome | Promise<SpsaOutcome>;

const shifted = (
  logW: Record<HardTerm, number>,
  delta: number[],
  ck: number,
): Record<HardTerm, number> => {
  const out = {} as Record<HardTerm, number>;
  HARD_TERMS.forEach((t, i) => {
    out[t] = Math.exp(logW[t] + ck * delta[i]!);
  });
  return out;
};

const unlog = (logW: Record<HardTerm, number>): Record<HardTerm, number> => {
  const out = {} as Record<HardTerm, number>;
  for (const t of HARD_TERMS) out[t] = Math.exp(logW[t]);
  return out;
};

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Núcleo SPSA puro, con la función de partida inyectada — así se puede
 * verificar la convergencia con una "arena" falsa determinista. Async:
 * cede el event loop entre partidas (corridas largas desde vitest).
 */
export async function runSpsa(
  start: Record<HardTerm, number>,
  opts: TuneOptions,
  play: MatchFn,
  onProgress?: (it: number, w: Record<HardTerm, number>) => void,
): Promise<Record<HardTerm, number>> {
  const rng = createSeededRng(opts.seed);
  const logW = {} as Record<HardTerm, number>;
  for (const t of HARD_TERMS) logW[t] = Math.log(start[t]);

  for (let k = 0; k < opts.iterations; k++) {
    const delta = HARD_TERMS.map(() => (rng() < 0.5 ? -1 : 1));
    const ck = opts.c / Math.pow(k + 1, 0.101);
    const ak = opts.a / Math.pow(k + 1 + 10, 0.602);
    const wPlus = shifted(logW, delta, ck);
    const wMinus = shifted(logW, delta, -ck);

    let plus = 0;
    let minus = 0;
    for (let g = 0; g < opts.gamesPerIteration; g++) {
      const r = await play(wPlus, wMinus, g);
      if (r === "plus") plus++;
      else if (r === "minus") minus++;
      await tick();
    }

    const grad = (plus - minus) / opts.gamesPerIteration;
    HARD_TERMS.forEach((t, i) => {
      logW[t] += ak * grad * delta[i]!;
    });
    if ((k + 1) % 10 === 0 || k + 1 === opts.iterations) onProgress?.(k + 1, unlog(logW));
  }
  return unlog(logW);
}

/**
 * Bot de tuning: juega con `searchHard` (modo nodos, personalidad balanced)
 * usando pesos arbitrarios. El setup es el greedy de Medium para ambos
 * lados — lo que se mide es la calidad de la evaluación en PLAYING.
 */
export function makeWeightsBot(
  weights: Record<HardTerm, number>,
  variant: RuleVariant,
  nodesPerMove: number,
  _rng: Rng,
  personality: Personality = "balanced",
): ComputerPlayer {
  const insight = getRulesInsight(variant.rules, variant.engine, variant.engine.config);
  const profile = getPersonalityProfile(personality);
  const tt = new TranspositionTable();
  return {
    difficulty: "hard",
    chooseSetupPlacement: (ctx: BotContext) =>
      chooseSetupPlacement(ctx, insight, targetComposition(insight)),
    chooseBenchType: (ctx: BotContext) => chooseBenchType(ctx, insight, targetComposition(insight)),
    choosePlayAction: (ctx: BotContext) => {
      const root = new SearchBoard(simFromContext(ctx), ctx.engine);
      const res = searchHard(
        root,
        ctx.bot,
        insight,
        weights,
        profile,
        { kind: "nodes", n: nodesPerMove },
        ctx.rng,
        tt,
      );
      return toBotPlayAction(res.actions[0] ?? null, ctx);
    },
  };
}

/**
 * SPSA sobre la arena real: `gamesPerIteration` partidas w+ vs w− por
 * iteración, colores alternados, semillas derivadas de `opts.seed`.
 */
export async function tuneHardWeights(
  start: Record<HardTerm, number>,
  variant: RuleVariant,
  opts: TuneOptions = DEFAULT_TUNE_OPTIONS,
  onProgress?: (it: number, w: Record<HardTerm, number>) => void,
): Promise<Record<HardTerm, number>> {
  const play: MatchFn = async (wPlus, wMinus, gi) => {
    const seed = opts.seed * 1_000_003 + gi * 7 + 1;
    if (opts.reference) {
      // Pareado: ambos candidatos contra el rival fijo, misma seed y color.
      const plusIsWhite = gi % 2 === 0;
      const score = (w: Record<HardTerm, number>): number => {
        const cand = makeWeightsBot(w, variant, opts.nodesPerMove, createSeededRng(seed + 2));
        const ref = opts.reference!(variant, seed + 4);
        const r = playArenaGame(plusIsWhite ? cand : ref, plusIsWhite ? ref : cand, variant, seed);
        if (r.illegalAction || !r.winner) return 0.5;
        return (r.winner === Player.BLANCAS) === plusIsWhite ? 1 : 0;
      };
      const sp = score(wPlus);
      const sm = score(wMinus);
      return sp > sm ? "plus" : sp < sm ? "minus" : "draw";
    }
    const rngPlus = createSeededRng(seed);
    const rngMinus = createSeededRng(seed + 1);
    const plusBot = makeWeightsBot(wPlus, variant, opts.nodesPerMove, rngPlus);
    const minusBot = makeWeightsBot(wMinus, variant, opts.nodesPerMove, rngMinus);
    const plusIsWhite = gi % 2 === 0;
    const result = playArenaGame(
      plusIsWhite ? plusBot : minusBot,
      plusIsWhite ? minusBot : plusBot,
      variant,
      seed,
    );
    if (result.illegalAction || !result.winner) return "draw";
    const plusWon = (result.winner === Player.BLANCAS) === plusIsWhite;
    return plusWon ? "plus" : "minus";
  };
  return runSpsa(start, opts, play, onProgress);
}

/** Validación: partidas `weights` vs `start` (o un rival de referencia) alternando colores. */
export async function validateWeights(
  weights: Record<HardTerm, number>,
  start: Record<HardTerm, number>,
  variant: RuleVariant,
  games: number,
  nodesPerMove: number,
  seed: number,
  pA: Personality = "balanced",
  pB: Personality = "balanced",
  reference?: (variant: RuleVariant, seed: number) => ComputerPlayer,
): Promise<{ wins: number; losses: number; draws: number; illegal: number }> {
  const out = { wins: 0, losses: 0, draws: 0, illegal: 0 };
  for (let i = 0; i < games; i++) {
    const s = seed + i * 131;
    const tuned = makeWeightsBot(weights, variant, nodesPerMove, createSeededRng(s), pA);
    const base = reference
      ? reference(variant, s + 1)
      : makeWeightsBot(start, variant, nodesPerMove, createSeededRng(s + 1), pB);
    const tunedIsWhite = i % 2 === 0;
    const result = playArenaGame(
      tunedIsWhite ? tuned : base,
      tunedIsWhite ? base : tuned,
      variant,
      s,
    );
    if (result.illegalAction) out.illegal++;
    else if (!result.winner) out.draws++;
    else if ((result.winner === Player.BLANCAS) === tunedIsWhite) out.wins++;
    else out.losses++;
    await tick();
  }
  return out;
}

/** Payload listo para serializar en `hard/weights.json`. */
export function weightsFilePayload(
  weights: Record<HardTerm, number>,
  variant: RuleVariant,
  games: number,
): { fingerprint: string; tunedAt: string; games: number; terms: Record<HardTerm, number> } {
  return {
    fingerprint: rulesFingerprint(variant.rules, variant.engine.config),
    tunedAt: new Date().toISOString(),
    games,
    terms: weights,
  };
}
