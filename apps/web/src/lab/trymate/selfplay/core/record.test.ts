import { describe, expect, it } from "vitest";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { PIECE_MOVEMENT_CONFIG } from "../../domain/constants/PieceConstants";
import { CURRENT_RULES, rulesFingerprint } from "../../domain/config/RulesView";
import {
  GAME_RECORD_SCHEMA,
  rulesFromSnapshot,
  snapshotRules,
  validateGameRecord,
  type GameRecord,
  type SideMetrics,
} from "./record";

const { BLANCAS, NEGRAS } = Player;

const sideMetrics = (): SideMetrics => ({
  avgFrontProgress: 3.2,
  maxProgress: 6,
  pliesToFirstScore: 41,
  capturesMade: 2,
  piecesLost: 1,
  opponentMaxProgress: 4,
  benchDrops: 1,
  randomActions: 3,
});

function validRecord(): GameRecord {
  return {
    schema: GAME_RECORD_SCHEMA,
    id: "b1-0",
    batchId: "b1",
    seed: 42,
    createdAt: "2025-09-25T10:00:00.000Z",
    gitSha: "abc123",
    rules: {
      fingerprint: rulesFingerprint(CURRENT_RULES, PIECE_MOVEMENT_CONFIG),
      variant: "current",
      view: snapshotRules(CURRENT_RULES),
      pieceConfig: PIECE_MOVEMENT_CONFIG,
    },
    players: {
      [BLANCAS]: { bot: "hard", difficulty: "hard", personality: "balanced", configHash: "h1" },
      [NEGRAS]: {
        bot: "hard",
        difficulty: "hard",
        personality: "offensive",
        budget: { kind: "nodes", n: 20000 },
        configHash: "h2",
      },
    },
    setupMode: "ALTERNATING",
    setup: {
      [BLANCAS]: {
        board: [
          { type: PieceType.FORT, x: 0, y: 1 },
          { type: PieceType.STRIKER, x: 2, y: 1 },
        ],
        bench: [PieceType.PIONEER],
        order: [0, 1],
      },
      [NEGRAS]: {
        board: [{ type: PieceType.FORT, x: 0, y: 9 }],
        bench: [],
        order: [0],
      },
    },
    opening: { randomPlies: 4, epsilon: 0.15, randomActions: [0, 3] },
    plies: [
      {
        n: 0,
        player: BLANCAS,
        kind: "move",
        pieceId: "p1",
        from: [0, 1],
        to: [0, 2],
        random: true,
      },
      {
        n: 1,
        player: NEGRAS,
        kind: "move",
        pieceId: "p9",
        from: [0, 9],
        to: [0, 8],
        decision: { eval: 12.5, depth: 6, nodes: 1800, ms: 95, posture: "BALANCED" },
        pos: "n|0,0|||0n0.9",
      },
      { n: 2, player: BLANCAS, kind: "bench", type: PieceType.PIONEER, to: [1, 1] },
      { n: 3, player: NEGRAS, kind: "pass" },
      {
        n: 4,
        player: BLANCAS,
        kind: "move",
        pieceId: "p1",
        from: [0, 2],
        to: [0, 9],
        capture: PieceType.FORT,
        scored: true,
      },
    ],
    result: {
      winner: BLANCAS,
      scores: { [BLANCAS]: 1, [NEGRAS]: 0 },
      reason: "points",
      plies: 5,
      durationMs: 1234,
    },
    metrics: { [BLANCAS]: sideMetrics(), [NEGRAS]: sideMetrics() },
  };
}

describe("record — schema trymate.game/1", () => {
  it("snapshotRules ↔ rulesFromSnapshot conservan el fingerprint", () => {
    const snap = snapshotRules(CURRENT_RULES);
    const rebuilt = rulesFromSnapshot(snap);
    expect(rebuilt.width).toBe(CURRENT_RULES.width);
    expect(rebuilt.height).toBe(CURRENT_RULES.height);
    expect([...rebuilt.placementRows(BLANCAS)]).toEqual(snap.placementRows[BLANCAS]);
    expect(rulesFingerprint(rebuilt, PIECE_MOVEMENT_CONFIG)).toBe(
      rulesFingerprint(CURRENT_RULES, PIECE_MOVEMENT_CONFIG),
    );
  });

  it("acepta un registro válido", () => {
    const res = validateGameRecord(validRecord());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.record.id).toBe("b1-0");
  });

  it("rechaza casos rotos con errores claros", () => {
    const cases: [string, (r: GameRecord) => void, RegExp][] = [
      [
        "schema incorrecto",
        (r) => ((r as unknown as Record<string, unknown>).schema = "trymate.game/2"),
        /schema/,
      ],
      ["id vacío", (r) => (r.id = ""), /id/],
      ["result.plies ≠ plies.length", (r) => (r.result.plies = 99), /result\.plies/],
      ["coordenada fuera del tablero", (r) => (r.plies[0]!.to = [9, 9]), /fuera del tablero/],
      [
        "setupMode inválido",
        (r) => ((r as unknown as Record<string, unknown>).setupMode = "SECRET"),
        /setupMode/,
      ],
      [
        "métrica faltante",
        (r) => {
          const m = r.metrics[BLANCAS] as unknown as Record<string, unknown>;
          delete m.capturesMade;
        },
        /metrics\.BLANCAS\.capturesMade/,
      ],
      [
        "tipo de banca inválido",
        (r) => {
          (r.setup[NEGRAS].bench as string[]).push("QUEEN");
        },
        /setup\.NEGRAS\.bench/,
      ],
      ["winner inválido", (r) => (r.result.winner = "ROJAS" as Player), /result\.winner/],
    ];
    for (const [name, mutate, pattern] of cases) {
      const r = structuredClone(validRecord());
      mutate(r);
      const res = validateGameRecord(r);
      expect(res.ok, `caso "${name}" debería fallar`).toBe(false);
      if (!res.ok) {
        expect(
          res.errors.some((e) => pattern.test(e)),
          `caso "${name}": ${res.errors.join(" | ")}`,
        ).toBe(true);
      }
    }
  });

  it("rechaza no-objetos y plies sin numerar en orden", () => {
    expect(validateGameRecord(null).ok).toBe(false);
    expect(validateGameRecord("x").ok).toBe(false);
    const r = structuredClone(validRecord());
    r.plies[1]!.n = 7;
    const res = validateGameRecord(r);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => /plies\[1\]\.n/.test(e))).toBe(true);
  });
});
