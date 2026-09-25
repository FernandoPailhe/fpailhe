import { describe, expect, it } from "vitest";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { rulesFingerprint } from "../../domain/config/RulesView";
import { RULE_VARIANTS } from "../../application/ai/testing/ruleVariants";
import { createAggregator, type Summary } from "./aggregate";
import { compareSummaries, renderCompare } from "./compare";
import { GAME_RECORD_SCHEMA, snapshotRules, type GameRecord, type SideMetrics } from "./record";

const B = Player.BLANCAS;
const N = Player.NEGRAS;
const CUR = RULE_VARIANTS[0]!;

const ZERO: SideMetrics = {
  avgFrontProgress: 0,
  maxProgress: 0,
  pliesToFirstScore: null,
  capturesMade: 0,
  piecesLost: 0,
  opponentMaxProgress: 0,
  benchDrops: 0,
  randomActions: 0,
};

/** Registro mínimo: setup de 1 pieza por bando, 0 plies, resultado declarado. */
const mkRecord = (id: string, batchId: string, winner: Player | null): GameRecord => ({
  schema: GAME_RECORD_SCHEMA,
  id,
  batchId,
  seed: 1,
  createdAt: "t",
  gitSha: null,
  rules: {
    fingerprint: rulesFingerprint(CUR.rules, CUR.engine.config),
    variant: "current",
    view: snapshotRules(CUR.rules),
    pieceConfig: CUR.engine.config,
  },
  players: {
    [B]: { bot: "easy", difficulty: "easy", configHash: "x" },
    [N]: { bot: "easy", difficulty: "easy", configHash: "x" },
  },
  setupMode: "ALTERNATING",
  setup: {
    [B]: { board: [{ type: PieceType.FORT, x: 0, y: 1 }], bench: [], order: [0] },
    [N]: { board: [{ type: PieceType.FORT, x: 0, y: 9 }], bench: [], order: [0] },
  },
  opening: { randomPlies: 0, epsilon: 0, randomActions: [] },
  plies: [],
  result: {
    winner,
    scores: { [B]: winner === B ? 1 : 0, [N]: winner === N ? 1 : 0 },
    reason: "points",
    plies: 0,
    durationMs: 1,
  },
  metrics: { [B]: { ...ZERO }, [N]: { ...ZERO } },
});

/** Summary con winsB victorias de B sobre n partidas. */
const mkSummary = (batchId: string, n: number, winsB: number): Summary => {
  const agg = createAggregator();
  for (let i = 0; i < n; i++) agg.add(mkRecord(`${batchId}-${i}`, batchId, i < winsB ? B : N));
  return agg.finish();
};

const rowOf = (res: ReturnType<typeof compareSummaries>, metric: string) =>
  res.groups[0]!.rows.find((r) => r.metric === metric)!;

describe("compareSummaries", () => {
  it("60% vs 40% con n=1000 → significativa; 52% vs 50% con n=200 → no", () => {
    const a = mkSummary("a", 1000, 600);
    const b = mkSummary("b", 1000, 400);
    const res = compareSummaries(a, b, { by: "all" });
    const wins = rowOf(res, "Victorias Blancas");
    expect(wins.significant).toBe(true);
    expect(wins.delta).toBe("-20.0pp");

    const c = mkSummary("c", 200, 104);
    const d = mkSummary("d", 200, 100);
    const res2 = compareSummaries(c, d, { by: "all" });
    expect(rowOf(res2, "Victorias Blancas").significant).toBe(false);
  });

  it("detecta mismo batchId y agrupa por variante", () => {
    const a = mkSummary("same", 100, 60);
    const res = compareSummaries(a, a, { by: "variant" });
    expect(res.warnings.some((w) => w.includes("mismo batchId"))).toBe(true);
    expect(res.groups.length).toBe(1);
    expect(res.groups[0]!.group).toContain("variant:current@");
    expect(rowOf(res, "Victorias Blancas").significant).toBe(false);
  });

  it("renderCompare produce markdown con tabla y warnings", () => {
    const a = mkSummary("a", 500, 300);
    const b = mkSummary("b", 500, 250);
    const md = renderCompare(compareSummaries(a, b, { by: "all" }));
    expect(md).toContain("# Comparación de batches");
    expect(md).toContain("| Métrica | A | B | Δ | Significativa |");
    expect(md).toContain("Victorias Blancas");
    expect(md).toContain("**sí**");
  });
});
