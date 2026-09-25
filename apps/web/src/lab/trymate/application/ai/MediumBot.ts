import { analyzeBoard } from "./analysis/boardAnalysis";
import type { BotContext, ComputerPlayer, DecisionInfo } from "./ComputerPlayer";
import { getRulesInsight, type RulesInsight } from "./introspection/profiles";
import { chooseBenchPlacement } from "./medium/benchPlacement";
import { MEDIUM_BOT_CONFIG, type Posture } from "./medium/config";
import { choosePosture, weightsFor } from "./medium/posture";
import { searchBestMove } from "./medium/search";
import { chooseBenchType, chooseSetupPlacement, targetComposition } from "./medium/setupStrategy";
import type { Rng } from "./rng";
import { simFromContext, type SimMove } from "./sim/SimState";

export interface MediumDecision {
  posture: Posture;
  depth: number;
  nodes: number;
  /** Jugadas raíz puntuadas, mejor primero. */
  top: { move: SimMove; score: number }[];
}

export interface MediumBot extends ComputerPlayer {
  /** Diagnóstico de la última búsqueda (null si aún no jugó en PLAYING). */
  readonly lastDecision: MediumDecision | null;
}

/**
 * Bot "medium": postura por turno → banca gratis si se puede → alfa-beta
 * (depth 2, 3 en finales) sobre evaluación con términos de análisis.
 * Todo lo que sabe de las reglas lo deriva del `RulesInsight` sondeado —
 * nunca muta el `BotContext`.
 */
export function createMediumBot(_rng: Rng): MediumBot {
  let lastDecision: MediumDecision | null = null;
  const insightOf = (ctx: BotContext): RulesInsight =>
    getRulesInsight(ctx.rules, ctx.engine, ctx.engine.config, MEDIUM_BOT_CONFIG.valueOverrides);

  return {
    difficulty: "medium",

    get lastDecision() {
      return lastDecision;
    },

    getLastDecisionInfo(): DecisionInfo | null {
      if (!lastDecision) return null;
      return {
        eval: lastDecision.top[0]?.score,
        depth: lastDecision.depth,
        nodes: lastDecision.nodes,
        posture: lastDecision.posture,
        top: lastDecision.top.map((t) => ({
          action: { kind: "move", pieceId: t.move.pieceId, to: t.move.to },
          score: t.score,
        })),
      };
    },

    chooseSetupPlacement(ctx) {
      return chooseSetupPlacement(ctx, insightOf(ctx), targetComposition(insightOf(ctx)));
    },

    chooseBenchType(ctx) {
      return chooseBenchType(ctx, insightOf(ctx), targetComposition(insightOf(ctx)));
    },

    choosePlayAction(ctx) {
      const insight = insightOf(ctx);
      const sim = simFromContext(ctx);
      const A = analyzeBoard(sim.board, ctx.engine, insight);
      const posture = choosePosture(sim, ctx.bot, ctx.engine, insight, A);
      const weights = weightsFor(posture);

      const bench = chooseBenchPlacement(sim, ctx.bot, ctx.engine, insight, weights, ctx.rng);
      if (bench) {
        const piece = ctx.botState.getBenchPieces().find((p) => p.type === bench.type);
        if (piece) return { kind: "bench", benchPieceId: piece.id, to: bench.to };
      }

      const result = searchBestMove(sim, ctx.bot, ctx.engine, insight, weights, ctx.rng);
      lastDecision = {
        posture,
        depth: result.depth,
        nodes: result.nodes,
        top: result.ranked.slice(0, 5),
      };
      if (!result.move) return { kind: "pass" };
      return { kind: "move", pieceId: result.move.pieceId, to: result.move.to };
    },
  };
}
