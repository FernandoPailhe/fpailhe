import { describe, expect, it } from "vitest";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { rulesFingerprint } from "../../domain/config/RulesView";
import { RULE_VARIANTS } from "../../application/ai/testing/ruleVariants";
import { createEasyBot } from "../../application/ai/EasyBot";
import type { Rng } from "../../application/ai/rng";
import { createAggregator } from "./aggregate";
import { playRecordedGame, type GameSpec } from "./playRecordedGame";
import {
  GAME_RECORD_SCHEMA,
  snapshotRules,
  type GameRecord,
  type PlyRecord,
  type SideMetrics,
} from "./record";

const B = Player.BLANCAS;
const N = Player.NEGRAS;
const CUR = RULE_VARIANTS[0]!; // current: 5×11, depth 3, place 5, bench 3

const ZERO_METRICS: SideMetrics = {
  avgFrontProgress: 0,
  maxProgress: 0,
  pliesToFirstScore: null,
  capturesMade: 0,
  piecesLost: 0,
  opponentMaxProgress: 0,
  benchDrops: 0,
  randomActions: 0,
};

const spec = { bot: "easy", difficulty: "easy", configHash: "test" };

interface Fixture {
  id: string;
  boardB: { type: PieceType; x: number; y: number }[];
  benchB?: PieceType[];
  boardN: { type: PieceType; x: number; y: number }[];
  benchN?: PieceType[];
  plies: Omit<PlyRecord, "n">[];
  winner: Player | null;
  scores?: Record<Player, number>;
  reason?: GameRecord["result"]["reason"];
}

/** Registro sintético válido para el agregador (plies deben ser legales). */
const mkRecord = (f: Fixture): GameRecord => ({
  schema: GAME_RECORD_SCHEMA,
  id: f.id,
  batchId: "b-test",
  seed: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  gitSha: null,
  rules: {
    fingerprint: rulesFingerprint(CUR.rules, CUR.engine.config),
    variant: "current",
    view: snapshotRules(CUR.rules),
    pieceConfig: CUR.engine.config,
  },
  players: { [B]: spec, [N]: spec },
  setupMode: "ALTERNATING",
  setup: {
    [B]: {
      board: f.boardB,
      bench: f.benchB ?? [],
      order: f.boardB.map((_, i) => i),
    },
    [N]: {
      board: f.boardN,
      bench: f.benchN ?? [],
      order: f.boardN.map((_, i) => i),
    },
  },
  opening: { randomPlies: 0, epsilon: 0, randomActions: [] },
  plies: f.plies.map((p, i) => ({ ...p, n: i })),
  result: {
    winner: f.winner,
    scores: f.scores ?? { [B]: f.winner === B ? 1 : 0, [N]: f.winner === N ? 1 : 0 },
    reason: f.reason ?? "points",
    plies: f.plies.length,
    durationMs: 1,
  },
  metrics: { [B]: { ...ZERO_METRICS }, [N]: { ...ZERO_METRICS } },
});

// r1: B striker captura un FORT en (2,5), baja un PIONEER, y un PIONEER anota.
const r1Fixture: Fixture = {
  id: "r1",
  boardB: [
    { type: PieceType.STRIKER, x: 2, y: 4 }, // w0
    { type: PieceType.FORT, x: 0, y: 1 }, // w1
    { type: PieceType.PIONEER, x: 4, y: 9 }, // w2
  ],
  benchB: [PieceType.PIONEER],
  boardN: [{ type: PieceType.FORT, x: 2, y: 5 }], // n0
  plies: [
    { player: B, kind: "move", pieceId: "w0", from: [2, 4], to: [2, 5], capture: PieceType.FORT },
    { player: N, kind: "pass" },
    { player: B, kind: "bench", pieceId: "wb0", type: PieceType.PIONEER, to: [3, 1] },
    { player: B, kind: "move", pieceId: "w2", from: [4, 9], to: [4, 10], scored: true },
  ],
  winner: B,
};
const rec1 = mkRecord(r1Fixture);

// r2: N pioneer anota primero y gana.
const rec2 = mkRecord({
  id: "r2",
  boardB: [{ type: PieceType.STRIKER, x: 2, y: 4 }],
  boardN: [{ type: PieceType.PIONEER, x: 1, y: 1 }],
  plies: [
    { player: B, kind: "move", pieceId: "w0", from: [2, 4], to: [2, 5] },
    { player: N, kind: "move", pieceId: "n0", from: [1, 1], to: [1, 0], scored: true },
  ],
  winner: N,
});

// r3: N anota primero pero gana B (comeback) + bajada de FORT.
const rec3 = mkRecord({
  id: "r3",
  boardB: [
    { type: PieceType.PIONEER, x: 4, y: 9 }, // w0
    { type: PieceType.FORT, x: 0, y: 1 }, // w1
  ],
  benchB: [PieceType.FORT],
  boardN: [{ type: PieceType.PIONEER, x: 1, y: 1 }],
  plies: [
    { player: B, kind: "move", pieceId: "w1", from: [0, 1], to: [0, 2] },
    { player: N, kind: "move", pieceId: "n0", from: [1, 1], to: [1, 0], scored: true },
    { player: B, kind: "bench", pieceId: "wb0", type: PieceType.FORT, to: [0, 1] },
    { player: B, kind: "move", pieceId: "w1", from: [0, 2], to: [0, 3] },
  ],
  winner: B,
  scores: { [B]: 3, [N]: 1 },
});

// r4: secuencia idéntica a r1 → duplicado.
const rec4 = mkRecord({ ...r1Fixture, id: "r4" });

// r5: marcha de 11 plies con decision.eval=100 en el ply 10 (calibración).
const rec5 = mkRecord({
  id: "r5",
  boardB: [{ type: PieceType.STRIKER, x: 2, y: 4 }],
  boardN: [],
  plies: [
    { player: B, kind: "move", pieceId: "w0", from: [2, 4], to: [2, 5] },
    { player: N, kind: "pass" },
    { player: B, kind: "move", pieceId: "w0", from: [2, 5], to: [2, 6] },
    { player: N, kind: "pass" },
    { player: B, kind: "move", pieceId: "w0", from: [2, 6], to: [2, 7] },
    { player: N, kind: "pass" },
    { player: B, kind: "move", pieceId: "w0", from: [2, 7], to: [2, 8] },
    { player: N, kind: "pass" },
    { player: B, kind: "move", pieceId: "w0", from: [2, 8], to: [2, 9] },
    { player: N, kind: "pass" },
    {
      player: B,
      kind: "move",
      pieceId: "w0",
      from: [2, 9],
      to: [2, 10],
      scored: true,
      decision: { eval: 100 },
    },
  ],
  winner: B,
});

const summarize = (records: GameRecord[]) => {
  const agg = createAggregator();
  for (const r of records) agg.add(r);
  return agg.finish();
};

describe("aggregate — registros sintéticos", () => {
  const summary = summarize([rec1, rec2, rec3, rec4, rec5]);
  const all = summary.groups["all"]!;

  it("conteos básicos y Wilson", () => {
    expect(summary.schema).toBe("trymate.summary/1");
    expect(summary.games).toBe(5);
    expect(all.n).toBe(5);
    expect(all.winsByColor[B].wins).toBe(4); // r1, r3, r4, r5
    expect(all.winsByColor[N].wins).toBe(1); // r2
    expect(all.winsByColor[B].share.p).toBeCloseTo(0.8, 6);
    expect(all.winsByColor[B].share.lo).toBeLessThan(0.8);
    expect(all.draws.n).toBe(0);
    expect(all.reasons).toEqual({ points: 5 });
    expect(all.plies.mean).toBeCloseTo((4 + 2 + 4 + 4 + 11) / 5, 6);
    expect(all.plies.p50).toBe(4);
  });

  it("primer tanto y comeback", () => {
    // r1/r4/r5: anota B y gana B; r2: anota N y gana N; r3: anota N y gana B.
    expect(all.firstScorerWins).not.toBeNull();
    expect(all.firstScorerWins!.n).toBe(5);
    expect(all.firstScorerWins!.share.p).toBeCloseTo(4 / 5, 6);
    expect(all.comebackRate!.share.p).toBeCloseTo(1 / 5, 6);
  });

  it("matriz de capturas y estadísticas por tipo", () => {
    expect(all.captureMatrix).toEqual({ STRIKER: { FORT: 2 } });
    expect(all.pieces["STRIKER"]!.capturesMade).toBe(2);
    expect(all.pieces["FORT"]!.capturesSuffered).toBe(2);
    // PIONEER anota en r1 (ply 3), r2 (ply 1), r3 (ply 1) y r4 (ply 3).
    expect(all.pieces["PIONEER"]!.pointsScored).toBe(4);
    expect(all.pieces["PIONEER"]!.pliesToScore).toBeCloseTo((3 + 1 + 1 + 3) / 4, 6);
    // Bajadas: PIONEER en r1+r4, FORT en r3.
    expect(all.pieces["PIONEER"]!.benchDrops).toBe(2);
    expect(all.pieces["FORT"]!.benchDrops).toBe(1);
    // Deployed: r1 STRIKER+FORT+PIONEER, r2 STRIKER, r3 PIONEER, r4 ×3, r5 STRIKER.
    expect(all.pieces["STRIKER"]!.deployed).toBe(4);
    expect(all.pieces["FORT"]!.deployed).toBe(5); // r1 w1+n0, r3 w1, r4 w1+n0
  });

  it("heatmaps: ocupación, capturas y columnas de anotación", () => {
    const hm = all.heatmaps!;
    expect(hm).not.toBeNull();
    expect(hm.occupancy.length).toBe(11); // height
    expect(hm.occupancy[0]!.length).toBe(5); // width
    expect(hm.captures[5]![2]).toBe(2); // capturas en (2,5): r1 y r4
    expect(hm.scoringColumns[4]).toBe(2); // tantos en x=4: r1, r4
    expect(hm.scoringColumns[1]).toBe(2); // tantos en x=1: r2, r3
    expect(hm.scoringColumns[2]).toBe(1); // r5
    expect(hm.occupancy[5]![2]).toBeGreaterThanOrEqual(2);
  });

  it("banca: bajadas por partida, ply promedio y win rate por cantidad", () => {
    expect(all.bench.dropsPerGame).toBeCloseTo((1 + 0 + 1 + 1 + 0) / 5, 6);
    expect(all.bench.avgDropPly).toBeCloseTo(2, 6);
    // r1: B bajó 1 (ganó), N bajó 0 (perdió); igual r4. r3: B bajó 1 (ganó), N 0.
    // r2: ambos 0 (ganó N). r5: ambos 0 (ganó B).
    expect(all.bench.byCount["1"]).toEqual({ n: 3, wins: 3 });
    expect(all.bench.byCount["0"]).toEqual({ n: 7, wins: 2 });
  });

  it("duplicados, apertura aleatoria y calibración", () => {
    expect(all.duplicates).toEqual({ games: 2, clusters: 1 });
    expect(all.randomOpeningShare).toBe(0);
    expect(all.calibration["10"]).toEqual([{ lo: 100, hi: 100, n: 1, winRate: 1 }]);
  });

  it("grupos y avisos", () => {
    const keys = Object.keys(summary.groups);
    expect(keys).toContain("all");
    expect(keys.some((k) => k.startsWith("variant:current@"))).toBe(true);
    expect(keys.some((k) => k.includes("|matchup:easyvseasy"))).toBe(true);
    expect(keys.some((k) => k.includes("|setup:ALTERNATING"))).toBe(true);
    // n=4 < 200 en subgrupos + duplicados 40% > 1%
    expect(summary.warnings.some((w) => w.includes("n="))).toBe(true);
    expect(summary.warnings.some((w) => w.includes("duplicadas"))).toBe(true);
  });

  it("composición y formación", () => {
    // r1/r4 B: FORT:1,PIONEER:1,STRIKER:1|bench:PIONEER → 2 lados, 2 wins
    const compKey = "FORT:1,PIONEER:1,STRIKER:1|bench:PIONEER";
    expect(all.byComposition[compKey]).toEqual({ n: 2, wins: 2 });
    // B despliega en filas front=9(y=9)... formación "front-mid-back" del setup
    expect(Object.keys(all.byFormation).length).toBeGreaterThan(0);
  });
});

describe("aggregate — batch real y rendimiento", () => {
  const spec2: GameSpec = {
    id: "g-agg",
    batchId: "b-agg",
    seed: 9,
    gitSha: null,
    variant: CUR,
    players: {
      [B]: { spec, create: (rng: Rng) => createEasyBot(rng) },
      [N]: { spec, create: (rng: Rng) => createEasyBot(rng) },
    },
    setupMode: "RANDOM",
    opening: { randomPlies: 6, epsilon: 1 },
    maxPlies: 300,
    recordPositions: false,
  };

  it("agrega registros reales de playRecordedGame coherentemente", async () => {
    const records: GameRecord[] = [];
    for (let i = 0; i < 5; i++) records.push(await playRecordedGame({ ...spec2, seed: 50 + i }));
    const summary = summarize(records);
    const all = summary.groups["all"]!;
    expect(all.n).toBe(5);
    expect(all.winsByColor[B].wins + all.winsByColor[N].wins + all.draws.n).toBe(5);
    expect(all.plies.mean).toBeGreaterThan(0);
    expect(all.heatmaps!.occupancy.length).toBe(11);
    // apertura epsilon=1: los primeros plies son random
    expect(all.randomOpeningShare).toBeGreaterThan(0);
    // razones conocidas
    for (const k of Object.keys(all.reasons)) {
      expect(["points", "blocked", "maxPlies"]).toContain(k);
    }
  }, 120_000);

  it("10 000 registros sintéticos: agrega en tiempo y memoria estables", () => {
    const agg = createAggregator();
    const t0 = Date.now();
    for (let i = 0; i < 10_000; i++) agg.add({ ...rec2, id: `m${i}` });
    const summary = agg.finish();
    expect(summary.games).toBe(10_000);
    expect(Date.now() - t0).toBeLessThan(10_000);
  });
});
