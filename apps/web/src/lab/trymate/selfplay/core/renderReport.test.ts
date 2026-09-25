import { describe, expect, it } from "vitest";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { rulesFingerprint } from "../../domain/config/RulesView";
import { RULE_VARIANTS } from "../../application/ai/testing/ruleVariants";
import { createAggregator } from "./aggregate";
import { renderReport } from "./renderReport";
import { GAME_RECORD_SCHEMA, snapshotRules, type GameRecord, type SideMetrics } from "./record";

const B = Player.BLANCAS;
const N = Player.NEGRAS;
const CUR = RULE_VARIANTS[0]!;

const ZERO: SideMetrics = {
  avgFrontProgress: 0.5,
  maxProgress: 2,
  pliesToFirstScore: 20,
  capturesMade: 1,
  piecesLost: 1,
  opponentMaxProgress: 2,
  benchDrops: 1,
  randomActions: 0,
};

const mkRecord = (id: string, winner: Player | null): GameRecord => ({
  schema: GAME_RECORD_SCHEMA,
  id,
  batchId: "b-snap",
  seed: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  gitSha: "abc123",
  rules: {
    fingerprint: rulesFingerprint(CUR.rules, CUR.engine.config),
    variant: "current",
    view: snapshotRules(CUR.rules),
    pieceConfig: CUR.engine.config,
  },
  players: {
    [B]: { bot: "easy", difficulty: "easy", configHash: "x" },
    [N]: { bot: "medium", difficulty: "medium", configHash: "y" },
  },
  setupMode: "ALTERNATING",
  setup: {
    [B]: {
      board: [
        { type: PieceType.STRIKER, x: 2, y: 4 },
        { type: PieceType.PIONEER, x: 4, y: 9 },
      ],
      bench: [PieceType.FORT],
      order: [0, 1],
    },
    [N]: {
      board: [
        { type: PieceType.FORT, x: 2, y: 5 },
        { type: PieceType.PIONEER, x: 1, y: 1 },
      ],
      bench: [PieceType.FORT],
      order: [0, 1],
    },
  },
  opening: { randomPlies: 0, epsilon: 0, randomActions: [] },
  plies: [
    {
      n: 0,
      player: B,
      kind: "move",
      pieceId: "w0",
      from: [2, 4],
      to: [2, 5],
      capture: PieceType.FORT,
      decision: { eval: 30 },
    },
    { n: 1, player: N, kind: "move", pieceId: "n1", from: [1, 1], to: [1, 0], scored: true },
    { n: 2, player: B, kind: "bench", pieceId: "wb0", type: PieceType.FORT, to: [1, 1] },
    { n: 3, player: B, kind: "move", pieceId: "w1", from: [4, 9], to: [4, 10], scored: true },
  ],
  result: {
    winner,
    scores: { [B]: winner === B ? 3 : 1, [N]: winner === N ? 3 : 1 },
    reason: "points",
    plies: 4,
    durationMs: 12,
  },
  metrics: { [B]: { ...ZERO }, [N]: { ...ZERO } },
});

describe("renderReport", () => {
  it("snapshot con summary sintético fijo", () => {
    const agg = createAggregator();
    for (let i = 0; i < 12; i++) agg.add(mkRecord(`g${i}`, i < 7 ? B : N));
    const summary = agg.finish();
    const md = renderReport(summary, {
      gitSha: "abc123",
      status: "completed",
      gamesPerHour: 5000,
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T01:00:00.000Z",
      experiment: { name: "snap", games: 12 },
    }).replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<ts>");
    expect(md).toMatchSnapshot();
  });

  it("todas las secciones presentes y ⚠ por n chico", () => {
    const agg = createAggregator();
    agg.add(mkRecord("g0", B));
    const summary = agg.finish();
    const md = renderReport(summary);
    for (const h of [
      "# Reporte de selfplay",
      "## Balance por variante",
      "## Piezas",
      "## Composiciones",
      "## Tablero",
      "## Banca y tempo",
      "## Personalidades",
      "## Datos",
    ]) {
      expect(md, h).toContain(h);
    }
    expect(md).toContain("⚠");
    expect(md).toContain("Matriz de capturas");
  });
});
