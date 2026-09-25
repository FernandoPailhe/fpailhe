import { describe, expect, it } from "vitest";
import { Player } from "../../domain/constants/PieceConstants";
import { Position } from "../../domain/entities/Position";
import { createEasyBot } from "../../application/ai/EasyBot";
import type { ComputerPlayer } from "../../application/ai/ComputerPlayer";
import type { Rng } from "../../application/ai/rng";
import { RULE_VARIANTS } from "../../application/ai/testing/ruleVariants";
import { validateGameRecord, type GameRecord, type PlayerSpec } from "./record";
import { IllegalActionError, playRecordedGame, type GameSpec } from "./playRecordedGame";
import { replayGame } from "./replay";

const EASY_SPEC: PlayerSpec = { bot: "easy", difficulty: "easy", configHash: "test" };
const easyPlayer = () => ({ spec: EASY_SPEC, create: (rng: Rng) => createEasyBot(rng) });

const makeSpec = (over: Partial<GameSpec> = {}): GameSpec => ({
  id: "g-test",
  batchId: "b-test",
  seed: 42,
  gitSha: null,
  variant: RULE_VARIANTS[0]!,
  players: {
    [Player.BLANCAS]: easyPlayer(),
    [Player.NEGRAS]: easyPlayer(),
  },
  setupMode: "ALTERNATING",
  opening: { randomPlies: 8, epsilon: 0.15 },
  maxPlies: 400,
  recordPositions: true,
  ...over,
});

/** Campos de tiempo que varían entre corridas idénticas. */
const normalize = (r: GameRecord): unknown =>
  JSON.parse(
    JSON.stringify(r, (k, v: unknown) =>
      k === "createdAt" || k === "durationMs" || k === "ms" ? "<t>" : v,
    ),
  );

describe("playRecordedGame", () => {
  it("Easy vs Easy en current y wide-7x13: 10 partidas c/u validan y re-juegan", async () => {
    const variants = [RULE_VARIANTS[0]!, RULE_VARIANTS[1]!];
    for (const variant of variants) {
      for (let i = 0; i < 10; i++) {
        const record = await playRecordedGame(makeSpec({ variant, seed: 1000 + i }));
        const valid = validateGameRecord(record);
        expect(valid.ok, `${variant.name}#${i}: ${valid.ok ? "" : valid.errors.join(" | ")}`).toBe(
          true,
        );
        const rep = replayGame(record);
        expect(rep.ok, `${variant.name}#${i}: ${rep.error ?? ""}`).toBe(true);
        expect(record.result.plies).toBe(record.plies.length);
        if (record.result.winner) {
          expect(record.result.scores[record.result.winner]).toBeGreaterThan(0);
        }
      }
    }
  }, 120_000);

  it("mismo spec → registros idénticos salvo campos de tiempo", async () => {
    const spec = makeSpec({ seed: 7 });
    const a = await playRecordedGame(spec);
    const b = await playRecordedGame(spec);
    expect(normalize(a)).toEqual(normalize(b));
  });

  it("epsilon=1 con randomPlies=4 marca las primeras 4 acciones como random", async () => {
    const record = await playRecordedGame(
      makeSpec({ seed: 3, opening: { randomPlies: 4, epsilon: 1 } }),
    );
    expect(record.plies.length).toBeGreaterThanOrEqual(4);
    for (const ply of record.plies.slice(0, 4)) expect(ply.random).toBe(true);
    expect(record.opening.randomActions).toEqual([0, 1, 2, 3]);
    expect(validateGameRecord(record).ok).toBe(true);
    expect(replayGame(record).ok).toBe(true);
  });

  it("un bot que devuelve una acción ilegal aborta con IllegalActionError", async () => {
    const cheater = (rng: Rng): ComputerPlayer => ({
      ...createEasyBot(rng),
      choosePlayAction: () => ({
        kind: "move",
        pieceId: "inexistente",
        to: new Position(0, 0),
      }),
    });
    const spec = makeSpec({
      opening: { randomPlies: 0, epsilon: 0 },
      players: {
        [Player.BLANCAS]: easyPlayer(),
        [Player.NEGRAS]: { spec: EASY_SPEC, create: cheater },
      },
    });
    await expect(playRecordedGame(spec)).rejects.toBeInstanceOf(IllegalActionError);
  });

  it.each(["HIDDEN", "RANDOM"] as const)(
    "setupMode %s produce un registro válido",
    async (mode) => {
      const record = await playRecordedGame(makeSpec({ seed: 11, setupMode: mode }));
      const valid = validateGameRecord(record);
      expect(valid.ok, valid.ok ? "" : valid.errors.join(" | ")).toBe(true);
      expect(record.setupMode).toBe(mode);
      for (const p of [Player.BLANCAS, Player.NEGRAS]) {
        const s = record.setup[p];
        expect(s.board).toHaveLength(record.rules.view.piecesToPlace);
        expect(s.bench).toHaveLength(record.rules.view.benchSize);
        expect(s.order).toHaveLength(s.board.length);
      }
      expect(replayGame(record).ok).toBe(true);
    },
  );

  it("corta en maxPlies con reason=maxPlies", async () => {
    const record = await playRecordedGame(
      makeSpec({ seed: 5, maxPlies: 12, opening: { randomPlies: 0, epsilon: 0 } }),
    );
    expect(record.plies).toHaveLength(12);
    expect(record.result.reason).toBe("maxPlies");
    expect(replayGame(record).ok).toBe(true);
  });

  it("métricas coherentes con los plies grabados", async () => {
    const record = await playRecordedGame(makeSpec({ seed: 21 }));
    const { metrics, plies } = record;
    const captures = plies.filter((p) => p.capture !== undefined);
    expect(metrics[Player.BLANCAS].capturesMade).toBe(
      captures.filter((p) => p.player === Player.BLANCAS).length,
    );
    expect(metrics[Player.BLANCAS].capturesMade).toBe(metrics[Player.NEGRAS].piecesLost);
    const benches = plies.filter((p) => p.kind === "bench");
    expect(metrics[Player.BLANCAS].benchDrops).toBe(
      benches.filter((p) => p.player === Player.BLANCAS).length,
    );
    expect(metrics[Player.BLANCAS].randomActions).toBe(
      plies.filter((p) => p.random && p.player === Player.BLANCAS).length,
    );
    for (const p of [Player.BLANCAS, Player.NEGRAS]) {
      expect(metrics[p].maxProgress).toBeGreaterThanOrEqual(0);
      expect(metrics[p].opponentMaxProgress).toBe(metrics[opposite(p)].maxProgress);
    }
    const firstScore = plies.find((p) => p.scored && p.player === Player.BLANCAS);
    expect(metrics[Player.BLANCAS].pliesToFirstScore).toBe(firstScore ? firstScore.n : null);
  });
});

const opposite = (p: Player): Player => (p === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS);

describe("replayGame — registros corruptos", () => {
  it("detecta un ply adulterado y un resultado adulterado", async () => {
    const record = await playRecordedGame(
      makeSpec({ seed: 9, maxPlies: 40, recordPositions: false }),
    );
    expect(replayGame(record).ok).toBe(true);

    const tampered = structuredClone(record);
    const move = tampered.plies.find((p) => p.kind === "move");
    expect(move).toBeDefined();
    move!.to = [0, 0];
    const r1 = replayGame(tampered);
    expect(r1.ok).toBe(false);
    expect(r1.mismatchAt).toBe(move!.n);

    const badWinner = structuredClone(record);
    badWinner.result.winner = record.result.winner === null ? Player.BLANCAS : null;
    expect(replayGame(badWinner).ok).toBe(false);
  });
});
