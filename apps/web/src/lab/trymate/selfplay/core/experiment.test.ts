import { describe, expect, it } from "vitest";
import { Player } from "../../domain/constants/PieceConstants";
import { rulesFingerprint } from "../../domain/config/RulesView";
import { RULE_VARIANTS } from "../../application/ai/testing/ruleVariants";
import { validateGameRecord } from "./record";
import { playRecordedGame } from "./playRecordedGame";
import { replayGame } from "./replay";
import { buildVariant, mergeDeep, validateRuleOverride } from "./ruleOverrides";
import {
  expandGames,
  materializeSpec,
  parseExperiment,
  stableConfigHash,
  type ExperimentConfig,
} from "./experiment";

const AVAILABLE = ["easy", "medium", "hard"];

const baseJson = () => ({
  name: "smoke",
  games: 10,
  seed: 1234,
  maxPlies: 300,
  workers: 2,
  setupModes: { ALTERNATING: 1 },
  opening: { randomPlies: 8, epsilon: 0.15 },
  swapColors: true,
  matchups: [{ white: { bot: "easy" }, black: { bot: "easy" }, weight: 1 }],
  rules: [{ variant: "current" }],
});

const cfg = (over: Record<string, unknown> = {}): ExperimentConfig =>
  parseExperiment({ ...baseJson(), ...over }, AVAILABLE);

describe("parseExperiment", () => {
  it("parsea una config válida", () => {
    const c = cfg();
    expect(c.name).toBe("smoke");
    expect(c.recordPositions).toBe(true); // default
    expect(c.matchups).toHaveLength(1);
  });

  it.each([
    [
      "bot no registrado",
      { matchups: [{ white: { bot: "stockfish" }, black: { bot: "easy" }, weight: 1 }] },
      /stockfish.*no está disponible/,
    ],
    [
      "budget por tiempo",
      {
        matchups: [
          {
            white: { bot: "easy", budget: { kind: "time", n: 300 } },
            black: { bot: "easy" },
            weight: 1,
          },
        ],
      },
      /budget/,
    ],
    ["games ≤ 0", { games: 0 }, /games/],
    [
      "peso negativo",
      { matchups: [{ white: { bot: "easy" }, black: { bot: "easy" }, weight: -1 }] },
      /weight/,
    ],
    ["setupModes desconocido", { setupModes: { SECRET: 1 } }, /modo desconocido/],
    ["setupModes todos 0", { setupModes: { ALTERNATING: 0 } }, /pesos son 0/],
    ["rules vacío", { rules: [] }, /rules/],
    [
      "reglas imposibles",
      { rules: [{ variant: "imposible", rules: { PIECES_TO_PLACE: 99 } }] },
      /imposibles|reglas/,
    ],
    [
      "clave de regla desconocida",
      { rules: [{ variant: "x", rules: { FOO: 1 } }] },
      /clave desconocida/,
    ],
    ["epsilon fuera de rango", { opening: { randomPlies: 4, epsilon: 1.5 } }, /epsilon/],
  ])("rechaza: %s", (_name, patch, pattern) => {
    expect(() => cfg(patch)).toThrow(pattern);
  });
});

describe("ruleOverrides", () => {
  it("buildVariant con board 7×13 da el fingerprint de wide-7x13", () => {
    const built = buildVariant({ variant: "wide", board: { BOARD_WIDTH: 7, BOARD_HEIGHT: 13 } });
    const expected = RULE_VARIANTS.find((v) => v.name === "wide-7x13")!;
    expect(rulesFingerprint(built.rules, built.engine.config)).toBe(
      rulesFingerprint(expected.rules, expected.engine.config),
    );
  });

  it("mergeDeep combina objetos y reemplaza escalares/arrays", () => {
    const base = { a: 1, m: { x: 1, y: 2 }, list: [1, 2] };
    const merged = mergeDeep(base, { m: { x: 9 }, list: [3], b: "nuevo" });
    expect(merged).toEqual({ a: 1, m: { x: 9, y: 2 }, list: [3], b: "nuevo" });
    expect(base.m.x).toBe(1); // base intacto
  });

  it("pieces altera la config de un tipo sin tocar el resto", () => {
    const v = buildVariant({
      variant: "striker3",
      pieces: { STRIKER: { alternativeMovement: { minDistance: 3, maxDistance: 3 } } },
    });
    expect(v.engine.config.STRIKER.alternativeMovement?.minDistance).toBe(3);
    expect(v.engine.config.FORT.movement.maxDistance).toBe(1);
    expect(validateRuleOverride({ variant: "striker3", pieces: { STRIKER: {} } }, "o")).toEqual([]);
    expect(validateRuleOverride({ variant: "x", pieces: { QUEEN: {} } }, "o")).toEqual([
      "o.pieces.QUEEN: tipo desconocido",
    ]);
  });
});

describe("expandGames", () => {
  it("determinista: misma cfg + batchId → mismos descriptores", () => {
    const c = cfg({
      rules: [{ variant: "a" }, { variant: "b", board: { BOARD_WIDTH: 7, BOARD_HEIGHT: 13 } }],
      matchups: [
        { white: { bot: "easy" }, black: { bot: "medium" }, weight: 3 },
        { white: { bot: "medium" }, black: { bot: "easy" }, weight: 1 },
      ],
      setupModes: { ALTERNATING: 2, RANDOM: 1 },
      games: 20,
    });
    const a = expandGames(c, "batch-1", null);
    const b = expandGames(c, "batch-1", null);
    expect(a).toEqual(b);
    expect(a).toHaveLength(20);
    expect(new Set(a.map((d) => d.id)).size).toBe(20);
    expect(a[0]!.id).toBe("batch-1-000000");
  });

  it("reparte por peso y alterna colores", () => {
    const c = cfg({
      games: 8,
      matchups: [{ white: { bot: "medium" }, black: { bot: "easy" }, weight: 1 }],
    });
    const out = expandGames(c, "b", null);
    const normal = out.filter((d) => d.players[Player.BLANCAS].bot === "medium");
    const swapped = out.filter((d) => d.players[Player.BLANCAS].bot === "easy");
    expect(normal).toHaveLength(4);
    expect(swapped).toHaveLength(4);
    for (const d of swapped) expect(d.players[Player.NEGRAS].bot).toBe("medium");
  });

  it("sin swapColors mantiene el color pedido", () => {
    const c = cfg({ swapColors: false, games: 5 });
    const out = expandGames(c, "b", null);
    for (const d of out) expect(d.players[Player.BLANCAS].bot).toBe("easy");
  });

  it("sortea setupMode por pesos", () => {
    const c = cfg({ games: 30, setupModes: { RANDOM: 1 } });
    for (const d of expandGames(c, "b", null)) expect(d.setupMode).toBe("RANDOM");
  });
});

describe("materializeSpec", () => {
  it("produce un GameSpec jugable y re-playable", async () => {
    const c = cfg({ games: 2, seed: 99 });
    const [d] = expandGames(c, "b", "abc123");
    const spec = await materializeSpec(d!);
    const record = await playRecordedGame(spec);
    expect(record.id).toBe(d!.id);
    expect(record.gitSha).toBe("abc123");
    expect(validateGameRecord(record).ok).toBe(true);
    expect(replayGame(record).ok).toBe(true);
    expect(record.players[Player.BLANCAS].difficulty).toBe("easy");
  });

  it("resuelve bots lazy (hard) en el materializador", async () => {
    const c = cfg({
      games: 1,
      matchups: [{ white: { bot: "hard" }, black: { bot: "easy" }, weight: 1 }],
    });
    const [d] = expandGames(c, "b", null);
    const spec = await materializeSpec(d!);
    const bot = spec.players[Player.BLANCAS].create(() => 0.5);
    expect(bot.difficulty).toBe("hard");
    expect(stableConfigHash(d!.players[Player.BLANCAS])).toBe(
      spec.players[Player.BLANCAS].spec.configHash,
    );
  });
});
