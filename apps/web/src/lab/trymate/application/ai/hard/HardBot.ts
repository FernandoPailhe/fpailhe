import { rulesFingerprint } from "../../../domain/config/RulesView";
import { Position } from "../../../domain/entities/Position";
import type { BotContext, BotPlayAction, ComputerPlayer, DecisionInfo } from "../ComputerPlayer";
import { getRulesInsight, type RulesInsight } from "../introspection/profiles";
import { chooseBenchType, chooseSetupPlacement, targetComposition } from "../medium/setupStrategy";
import type { Personality } from "../personality";
import type { Rng } from "../rng";
import { simFromContext } from "../sim/SimState";
import { toBotPlayAction, toBotPlayActions } from "./botAction";
import { HARD_BOT_CONFIG, type HardBotConfig } from "./config";
import { HardBotClient } from "./HardBotClient";
import { getPersonalityProfile } from "./personalities";
import { toHardRequest } from "./protocol";
import { SearchBoard } from "./SearchBoard";
import { searchHard, type HardSearchResult } from "./search";
import { nextBenchFromPlan, nextFromPlan, type ArmyPlan } from "./setup";
import { loadHardWeights } from "./weights";

export interface HardBot extends ComputerPlayer {
  /** Diagnóstico de la última búsqueda (null si aún no jugó en PLAYING). */
  readonly lastResult: HardSearchResult | null;
  /** Termina el worker; el store lo invoca al resetear/cambiar de partida. */
  dispose(): void;
}

/**
 * Bot "hard": búsqueda profunda en un Web Worker (lazy: este módulo solo se
 * descarga al elegir la dificultad). El setup se planifica una vez por
 * request "setup" y los métodos sync consumen el plan; sin plan (worker
 * caído, partida restaurada) delegan en el greedy de Medium.
 */
export function createHardBot(
  _rng: Rng,
  opts: {
    personality: Personality;
    overrides?: Partial<HardBotConfig>;
    /** Fuerza el camino inline aunque exista Worker (tests deterministas). */
    forceInline?: boolean;
  },
): HardBot {
  const config = { ...HARD_BOT_CONFIG, ...opts.overrides };
  const client = new HardBotClient({
    forceInline: opts.forceInline,
    fallbackBudget: config.fallbackBudget,
    inlineSetupBudget: config.inlineSetupBudget,
  });
  const profile = getPersonalityProfile(opts.personality);
  let lastResult: HardSearchResult | null = null;
  let lastTopAction: BotPlayAction | null = null;
  let plan: ArmyPlan | null = null;
  let planFoeVisible = -1;
  let requestId = 0;
  let warnedStale = false;

  const insightOf = (ctx: BotContext): RulesInsight =>
    getRulesInsight(ctx.rules, ctx.engine, ctx.engine.config);
  const seedOf = (ctx: BotContext): number => Math.floor(ctx.rng() * 0x7fffffff);
  const foeVisibleCount = (ctx: BotContext): number =>
    ctx.board.getAllPieces().filter((p) => p.owner !== ctx.bot && p.position).length;
  const greedyPlacement = (ctx: BotContext) =>
    chooseSetupPlacement(ctx, insightOf(ctx), targetComposition(insightOf(ctx)));
  const greedyBench = (ctx: BotContext) =>
    chooseBenchType(ctx, insightOf(ctx), targetComposition(insightOf(ctx)));

  const warnStale = (ctx: BotContext): void => {
    if (warnedStale || !import.meta.env.DEV) return;
    const { stale } = loadHardWeights(rulesFingerprint(ctx.rules, ctx.engine.config));
    if (stale) {
      warnedStale = true;
      console.warn("Hard: pesos ajustados para otras reglas; usando defaults. Correr tuneHard.");
    }
  };

  return {
    difficulty: "hard",

    get lastResult() {
      return lastResult;
    },

    getLastDecisionInfo(): DecisionInfo | null {
      if (!lastResult) return null;
      return {
        eval: lastResult.score,
        depth: lastResult.depth,
        nodes: lastResult.nodes,
        ms: lastResult.ms,
        personality: opts.personality,
        top: lastTopAction ? [{ action: lastTopAction, score: lastResult.score }] : [],
      };
    },

    dispose() {
      client.dispose();
    },

    async prepareSetupAsync(ctx, signal) {
      warnStale(ctx);
      const foe = foeVisibleCount(ctx);
      if (plan && foe === planFoeVisible) return;
      const req = toHardRequest(
        ctx,
        config.fallbackBudget,
        seedOf(ctx),
        ++requestId,
        opts.personality,
        "setup",
        config.setupBudget,
      );
      const res = await client.plan(req, signal);
      plan = {
        boardPieces: res.boardPieces.map((p) => ({
          type: p.type,
          position: new Position(p.x, p.y),
        })),
        benchPieces: [...res.benchPieces],
      };
      planFoeVisible = foe;
    },

    chooseSetupPlacement(ctx) {
      return (plan ? nextFromPlan(ctx, plan) : null) ?? greedyPlacement(ctx);
    },

    chooseBenchType(ctx) {
      return (plan ? nextBenchFromPlan(ctx, plan) : null) ?? greedyBench(ctx);
    },

    async choosePlayActionAsync(ctx, signal) {
      warnStale(ctx);
      const req = toHardRequest(
        ctx,
        config.budget,
        seedOf(ctx),
        ++requestId,
        opts.personality,
        "play",
      );
      const res = await client.search(req, signal);
      lastResult = res;
      const actions = toBotPlayActions(res.actions, ctx);
      lastTopAction = actions[0] ?? null;
      return actions;
    },

    // Sincrónico (fallback / tests): búsqueda inline con presupuesto reducido.
    choosePlayAction(ctx) {
      warnStale(ctx);
      const { weights } = loadHardWeights(rulesFingerprint(ctx.rules, ctx.engine.config));
      const root = new SearchBoard(simFromContext(ctx), ctx.engine);
      const res = searchHard(
        root,
        ctx.bot,
        insightOf(ctx),
        weights,
        profile,
        config.fallbackBudget,
        ctx.rng,
      );
      lastResult = res;
      const action = toBotPlayAction(res.actions[0] ?? null, ctx);
      lastTopAction = action;
      return action;
    },
  };
}
