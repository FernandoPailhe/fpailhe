import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../../domain/constants/GameRules";
import { countsOf, isCompositionFeasible } from "../../../domain/rules/composition";
import type { BotContext, ComputerPlayer } from "../ComputerPlayer";
import { createMediumBot } from "../MediumBot";
import { getRulesInsight } from "../introspection/profiles";
import { createSeededRng, type Rng } from "../rng";
import { runArena } from "../arena";
import { RULE_VARIANTS, type RuleVariant } from "../testing/ruleVariants";
import { getPersonalityProfile } from "./personalities";
import {
  nextBenchFromPlan,
  nextFromPlan,
  planHardArmy,
  tiltedComposition,
  type ArmyPlan,
} from "./setup";

const BOT = Player.NEGRAS;
const pos = (x: number, y: number) => new Position(x, y);

const mkCtx = (
  variant: RuleVariant,
  opts: {
    board?: Board;
    botState?: PlayerState;
    opponentState?: PlayerState;
    setupMode?: SetupTurnMode;
    bot?: Player;
    rng?: Rng;
  } = {},
): BotContext => ({
  board: opts.board ?? new Board(variant.rules.width, variant.rules.height),
  bot: opts.bot ?? BOT,
  botState: opts.botState ?? new PlayerState("bot"),
  opponentState: opts.opponentState ?? new PlayerState("opp"),
  engine: variant.engine,
  rules: variant.rules,
  setupMode: opts.setupMode ?? SetupTurnMode.ALTERNATING,
  rng: opts.rng ?? createSeededRng(1),
});

const insightOf = (variant: RuleVariant) =>
  getRulesInsight(variant.rules, variant.engine, variant.engine.config);

const planKey = (plan: ArmyPlan): string =>
  JSON.stringify({
    board: plan.boardPieces.map((p) => [p.type, p.position.x, p.position.y]),
    bench: plan.benchPieces,
  });

/** Validez básica de un plan contra las reglas de la variante. */
const expectValidPlan = (variant: RuleVariant, plan: ArmyPlan, bot: Player): void => {
  const { rules } = variant;
  expect(plan.boardPieces).toHaveLength(rules.piecesToPlace);
  expect(plan.benchPieces).toHaveLength(rules.benchSize);
  const seen = new Set<string>();
  const rowUse = new Map<number, number>();
  const rows = rules.placementRows(bot);
  for (const { position } of plan.boardPieces) {
    expect(rows).toContain(position.y);
    const key = `${position.x},${position.y}`;
    expect(seen.has(key)).toBe(false);
    seen.add(key);
    rowUse.set(position.y, (rowUse.get(position.y) ?? 0) + 1);
    expect(rowUse.get(position.y)!).toBeLessThanOrEqual(rules.maxPerRow);
  }
  const all = countsOf([...plan.boardPieces.map((p) => p.type), ...plan.benchPieces], rules);
  expect(isCompositionFeasible(all, 0, rules)).toBe(true);
};

describe("hard/setup — planHardArmy", () => {
  it("produce ejércitos válidos en las 5 variantes", () => {
    for (const variant of RULE_VARIANTS) {
      const plan = planHardArmy(
        mkCtx(variant),
        insightOf(variant),
        getPersonalityProfile("balanced"),
        createSeededRng(7),
        { candidates: 4, nodesPerEval: 150 },
      );
      expectValidPlan(variant, plan, BOT);
    }
  });

  it("determinista: misma semilla → mismo plan (vista HIDDEN)", () => {
    const variant = RULE_VARIANTS[0]!;
    const board = new Board(variant.rules.width, variant.rules.height);
    // Vista HIDDEN del bot: solo ve sus piezas ya colocadas.
    board.addPiece(new GamePiece("n1", PieceType.FORT, pos(0, 7), BOT));
    board.addPiece(new GamePiece("n2", PieceType.STRIKER, pos(1, 8), BOT));
    const ps = new PlayerState("bot");
    ps.addSelectedPiece(PieceType.FORT);
    ps.addSelectedPiece(PieceType.STRIKER);
    const ctx = mkCtx(variant, {
      board,
      botState: ps,
      setupMode: SetupTurnMode.HIDDEN,
    });
    const p1 = planHardArmy(
      ctx,
      insightOf(variant),
      getPersonalityProfile("balanced"),
      createSeededRng(11),
      {
        candidates: 4,
        nodesPerEval: 100,
      },
    );
    const p2 = planHardArmy(
      ctx,
      insightOf(variant),
      getPersonalityProfile("balanced"),
      createSeededRng(11),
      {
        candidates: 4,
        nodesPerEval: 100,
      },
    );
    expect(planKey(p1)).toBe(planKey(p2));
    expectValidPlan(variant, p1, BOT);
  });

  it("tiltedComposition: offensive sube corredores; defensive, bloqueadores", () => {
    const variant = RULE_VARIANTS[0]!;
    const insight = insightOf(variant);
    const roleOf = (t: (typeof variant.rules.pieceTypes)[number], role: "runner" | "blocker") =>
      insight.profiles.get(t)?.roles.has(role) ?? false;
    const runnerCount = (c: Record<string, number>) =>
      variant.rules.pieceTypes.reduce((s, t) => s + (roleOf(t, "runner") ? c[t]! : 0), 0);
    const blockerCount = (c: Record<string, number>) =>
      variant.rules.pieceTypes.reduce((s, t) => s + (roleOf(t, "blocker") ? c[t]! : 0), 0);

    const off = tiltedComposition(insight, getPersonalityProfile("offensive"));
    const def = tiltedComposition(insight, getPersonalityProfile("defensive"));
    expect(runnerCount(off)).toBeGreaterThan(runnerCount(def));
    expect(blockerCount(def)).toBeGreaterThan(blockerCount(off));
  });

  it("en promedio offensive despliega más adelante que defensive", () => {
    const variant = RULE_VARIANTS[0]!;
    const { rules } = variant;
    const insight = insightOf(variant);
    const home = rules.homeRow(BOT);
    const byDepth = [...rules.placementRows(BOT)].sort(
      (a, b) => Math.abs(a - home) - Math.abs(b - home),
    );
    const front = new Set(byDepth.slice(Math.floor(byDepth.length / 2)));
    const frontCount = (plan: ArmyPlan) =>
      plan.boardPieces.filter((p) => front.has(p.position.y)).length;
    const budget = { candidates: 4, nodesPerEval: 100 };
    const mean = (personality: "offensive" | "defensive"): number => {
      let total = 0;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const plan = planHardArmy(
          mkCtx(variant),
          insight,
          getPersonalityProfile(personality),
          createSeededRng(100 + i),
          budget,
        );
        total += frontCount(plan);
      }
      return total / n;
    };
    expect(mean("offensive")).toBeGreaterThan(mean("defensive"));
  }, 30_000);
});

describe("hard/setup — consumo del plan", () => {
  const variant = RULE_VARIANTS[0]!;

  it("nextFromPlan/nextBenchFromPlan sirven el plan pieza a pieza hasta agotarlo", () => {
    const insight = insightOf(variant);
    const ctx = mkCtx(variant);
    const plan = planHardArmy(ctx, insight, getPersonalityProfile("balanced"), createSeededRng(5), {
      candidates: 4,
      nodesPerEval: 100,
    });

    // Simular el despliegue sirviendo el plan.
    const board = ctx.board;
    const ps = ctx.botState;
    let placed = 0;
    for (let i = 0; i < 30 && placed < variant.rules.piecesToPlace; i++) {
      const next = nextFromPlan({ ...ctx, board, botState: ps }, plan);
      if (!next) break;
      const piece = new GamePiece(`p-${i}`, next.type, next.position, BOT);
      board.addPiece(piece);
      ps.addSelectedPiece(next.type);
      placed += 1;
    }
    expect(placed).toBe(variant.rules.piecesToPlace);
    expect(nextFromPlan({ ...ctx, board, botState: ps }, plan)).toBeNull();

    let benched = 0;
    for (let i = 0; i < 10 && benched < variant.rules.benchSize; i++) {
      const type = nextBenchFromPlan({ ...ctx, board, botState: ps }, plan);
      if (!type) break;
      ps.addBenchPiece(new GamePiece(`b-${i}`, type, null, BOT));
      benched += 1;
    }
    expect(benched).toBe(variant.rules.benchSize);
    expect(nextBenchFromPlan({ ...ctx, board, botState: ps }, plan)).toBeNull();
  });
});

describe("hard/setup — mini-arena (informativo)", () => {
  it("setup Hard vs greedy Medium con motor Medium: log del win-rate", () => {
    const variant = RULE_VARIANTS[0]!;
    const insight = insightOf(variant);
    const { rules } = variant;

    // Plan Hard calculado una vez para NEGRAS (determinista); para BLANCAS se
    // usa su espejo vertical.
    const hardPlan = planHardArmy(
      mkCtx(variant),
      insight,
      getPersonalityProfile("balanced"),
      createSeededRng(77),
      { candidates: 6, nodesPerEval: 300 },
    );
    const mirror = (plan: ArmyPlan): ArmyPlan => ({
      boardPieces: plan.boardPieces.map(({ type, position }) => ({
        type,
        position: new Position(position.x, rules.height - 1 - position.y),
      })),
      benchPieces: [...plan.benchPieces],
    });
    const plans: Record<Player, ArmyPlan> = {
      [Player.NEGRAS]: hardPlan,
      [Player.BLANCAS]: mirror(hardPlan),
    };

    const hardSetupBot = (rng: Rng): ComputerPlayer => {
      const medium = createMediumBot(rng);
      return {
        difficulty: medium.difficulty,
        chooseSetupPlacement: (ctx) =>
          nextFromPlan(ctx, plans[ctx.bot]) ?? medium.chooseSetupPlacement(ctx),
        chooseBenchType: (ctx) =>
          nextBenchFromPlan(ctx, plans[ctx.bot]) ?? medium.chooseBenchType(ctx),
        choosePlayAction: (ctx) => medium.choosePlayAction(ctx),
      };
    };

    const summary = runArena(hardSetupBot, createMediumBot, variant, 20, 5);
    const winRate = summary.aWins / 20;
    // Informativo (no bloqueante): el plan Hard debería dar ventaja al setup.
    console.log(
      `[hard-setup] arena setup-Hard vs setup-Medium (motor Medium, 20 partidas): ` +
        `${summary.aWins}–${summary.bWins}–${summary.draws} (${(winRate * 100).toFixed(0)}%), ` +
        `ilegales=${summary.illegal}${summary.firstIllegalAction ? " " + summary.firstIllegalAction : ""}`,
    );
    expect(summary.illegal).toBe(0);
    if (winRate < 0.55) {
      console.warn(
        `[hard-setup] win-rate ${(winRate * 100).toFixed(0)}% < 55% — revisar calidad del plan`,
      );
    }
  }, 120_000);
});
