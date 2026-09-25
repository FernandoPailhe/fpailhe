import { Player } from "../../domain/constants/PieceConstants";
import { loadBotFactory, type BotDifficulty } from "../../application/ai/ComputerPlayer";
import { PERSONALITIES, type Personality } from "../../application/ai/personality";
import { createSeededRng, type Rng } from "../../application/ai/rng";
import { buildVariant, validateRuleOverride, type RuleOverride } from "./ruleOverrides";
import type { PlayerSpec } from "./record";
import type { GameSpec } from "./playRecordedGame";

/** Bot de un experimento, por referencia serializable (sin fábrica). */
export interface BotRef {
  bot: BotDifficulty;
  personality?: Personality;
  budget?: { kind: "nodes"; n: number };
}

export interface ExperimentConfig {
  name: string;
  games: number;
  seed: number;
  maxPlies: number;
  workers: number | "auto";
  setupModes: Partial<Record<"ALTERNATING" | "HIDDEN" | "RANDOM", number>>;
  opening: { randomPlies: number; epsilon: number };
  swapColors: boolean;
  recordPositions: boolean;
  matchups: { white: BotRef; black: BotRef; weight: number }[];
  rules: RuleOverride[];
}

/** Versión serializable de GameSpec: viaja por postMessage al worker. */
export interface GameSpecDescriptor {
  id: string;
  batchId: string;
  seed: number;
  gitSha: string | null;
  variant: RuleOverride;
  players: Record<Player, BotRef>;
  setupMode: "ALTERNATING" | "HIDDEN" | "RANDOM";
  opening: { randomPlies: number; epsilon: number };
  maxPlies: number;
  recordPositions: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const SETUP_MODES = ["ALTERNATING", "HIDDEN", "RANDOM"] as const;
type SetupMode = (typeof SETUP_MODES)[number];

function checkBotRef(
  v: unknown,
  label: string,
  available: readonly string[],
  errors: string[],
): void {
  if (!isObj(v)) {
    errors.push(`${label}: no es objeto`);
    return;
  }
  if (typeof v.bot !== "string" || v.bot === "") {
    errors.push(`${label}.bot: falta`);
  } else if (!available.includes(v.bot)) {
    errors.push(`${label}.bot: "${v.bot}" no está disponible todavía`);
  }
  if (v.personality !== undefined && !PERSONALITIES.includes(v.personality as Personality)) {
    errors.push(`${label}.personality: debe ser una de ${PERSONALITIES.join("|")}`);
  }
  if (v.budget !== undefined) {
    if (!isObj(v.budget) || v.budget.kind !== "nodes" || !isInt(v.budget.n) || v.budget.n <= 0) {
      errors.push(`${label}.budget: debe ser { kind: "nodes", n: entero >0 }`);
    }
  }
}

/**
 * Parsea y valida la config JSON de un experimento. Lanza Error con la lista
 * completa de problemas encontrados.
 */
export function parseExperiment(json: unknown, available: readonly string[]): ExperimentConfig {
  const errors: string[] = [];
  if (!isObj(json)) throw new Error("experimento inválido: no es un objeto");
  const c = json;

  if (typeof c.name !== "string" || c.name === "") errors.push("name: falta");
  if (!isInt(c.games) || c.games <= 0) errors.push("games: debe ser entero >0");
  if (!isInt(c.seed)) errors.push("seed: debe ser entero");
  if (!isInt(c.maxPlies) || c.maxPlies <= 0) errors.push("maxPlies: debe ser entero >0");
  if (!(c.workers === "auto" || (isInt(c.workers) && c.workers > 0))) {
    errors.push('workers: debe ser entero >0 o "auto"');
  }

  if (!isObj(c.setupModes)) {
    errors.push("setupModes: no es objeto");
  } else {
    let total = 0;
    for (const [k, v] of Object.entries(c.setupModes)) {
      if (!SETUP_MODES.includes(k as SetupMode)) {
        errors.push(`setupModes.${k}: modo desconocido`);
        continue;
      }
      if (!isNum(v) || v < 0) {
        errors.push(`setupModes.${k}: peso debe ser número ≥0`);
        continue;
      }
      total += v;
    }
    if (errors.length === 0 && total <= 0) errors.push("setupModes: todos los pesos son 0");
  }

  if (!isObj(c.opening)) {
    errors.push("opening: no es objeto");
  } else {
    if (!isInt(c.opening.randomPlies) || c.opening.randomPlies < 0)
      errors.push("opening.randomPlies: debe ser entero ≥0");
    if (!isNum(c.opening.epsilon) || c.opening.epsilon < 0 || c.opening.epsilon > 1)
      errors.push("opening.epsilon: debe estar en [0,1]");
  }

  if (typeof c.swapColors !== "boolean") errors.push("swapColors: debe ser boolean");
  if (c.recordPositions !== undefined && typeof c.recordPositions !== "boolean") {
    errors.push("recordPositions: debe ser boolean");
  }

  const matchups: ExperimentConfig["matchups"] = [];
  if (!Array.isArray(c.matchups) || c.matchups.length === 0) {
    errors.push("matchups: debe ser array no vacío");
  } else {
    for (const [i, m] of c.matchups.entries()) {
      const label = `matchups[${i}]`;
      if (!isObj(m)) {
        errors.push(`${label}: no es objeto`);
        continue;
      }
      checkBotRef(m.white, `${label}.white`, available, errors);
      checkBotRef(m.black, `${label}.black`, available, errors);
      if (!isNum(m.weight) || m.weight <= 0) errors.push(`${label}.weight: debe ser >0`);
      if (isObj(m.white) && isObj(m.black) && isNum(m.weight)) {
        matchups.push({
          white: m.white as unknown as BotRef,
          black: m.black as unknown as BotRef,
          weight: m.weight,
        });
      }
    }
  }

  const rules: RuleOverride[] = [];
  if (!Array.isArray(c.rules) || c.rules.length === 0) {
    errors.push("rules: debe ser array no vacío");
  } else {
    for (const [i, o] of c.rules.entries()) {
      const errs = validateRuleOverride(o, `rules[${i}]`);
      if (errs.length) errors.push(...errs);
      else rules.push(o as RuleOverride);
    }
  }

  if (errors.length) {
    throw new Error(`experimento inválido:\n- ${errors.join("\n- ")}`);
  }

  return {
    name: c.name as string,
    games: c.games as number,
    seed: c.seed as number,
    maxPlies: c.maxPlies as number,
    workers: c.workers as number | "auto",
    setupModes: c.setupModes as ExperimentConfig["setupModes"],
    opening: {
      randomPlies: (c.opening as { randomPlies: number }).randomPlies,
      epsilon: (c.opening as { epsilon: number }).epsilon,
    },
    swapColors: c.swapColors as boolean,
    recordPositions: (c.recordPositions as boolean | undefined) ?? true,
    matchups,
    rules,
  };
}

/** Reparto por mayor resto: total unidades entre celdas pesadas. */
function largestRemainder(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const counts = exact.map(Math.floor);
  let rest = total - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    counts[i]! += 1;
    rest -= 1;
  }
  return counts;
}

const mixSeed = (seed: number, i: number): number => (seed ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0;

/**
 * Expande un experimento a la lista determinista de partidas: reparte `games`
 * entre rules × matchups por peso, alterna colores si `swapColors` y sortea el
 * `setupMode` por pesos con el rng del experimento. Ídem misma cfg + batchId.
 */
export function expandGames(
  cfg: ExperimentConfig,
  batchId: string,
  gitSha: string | null,
): GameSpecDescriptor[] {
  const rng = createSeededRng(cfg.seed);
  const modes = SETUP_MODES.filter((m) => (cfg.setupModes[m] ?? 0) > 0).map((m) => ({
    mode: m,
    weight: cfg.setupModes[m]!,
  }));
  const modeTotal = modes.reduce((a, m) => a + m.weight, 0);
  const drawMode = (): SetupMode => {
    let roll = rng() * modeTotal;
    for (const m of modes) {
      roll -= m.weight;
      if (roll <= 0) return m.mode;
    }
    return modes[modes.length - 1]!.mode;
  };

  // Celdas rules × matchups: cada regla pesa igual dentro del matchup.
  const cells: { variant: RuleOverride; matchup: ExperimentConfig["matchups"][number] }[] = [];
  for (const variant of cfg.rules) {
    for (const matchup of cfg.matchups) cells.push({ variant, matchup });
  }
  const counts = largestRemainder(
    cfg.games,
    cells.map((c) => c.matchup.weight),
  );

  const out: GameSpecDescriptor[] = [];
  let i = 0;
  for (const [ci, cell] of cells.entries()) {
    const n = counts[ci] ?? 0;
    const normalCount = cfg.swapColors ? Math.ceil(n / 2) : n;
    for (let k = 0; k < n; k++) {
      const swapped = cfg.swapColors && k >= normalCount;
      out.push({
        id: `${batchId}-${String(i).padStart(6, "0")}`,
        batchId,
        seed: mixSeed(cfg.seed, i),
        gitSha,
        variant: cell.variant,
        players: {
          [Player.BLANCAS]: swapped ? cell.matchup.black : cell.matchup.white,
          [Player.NEGRAS]: swapped ? cell.matchup.white : cell.matchup.black,
        },
        setupMode: drawMode(),
        opening: cfg.opening,
        maxPlies: cfg.maxPlies,
        recordPositions: cfg.recordPositions,
      });
      i += 1;
    }
  }
  return out;
}

/** JSON.stringify con claves ordenadas — estable para hashing. */
const stableStringify = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    isObj(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );

/** Hash djb2 en hex — configHash de un bot, no criptográfico. */
export const stableConfigHash = (v: unknown): string => {
  const s = stableStringify(v);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
};

const playerSpecOf = (ref: BotRef): PlayerSpec => ({
  bot: ref.bot,
  difficulty: ref.bot,
  personality: ref.personality,
  budget: ref.budget,
  configHash: stableConfigHash(ref),
});

/**
 * Materializa un descriptor en un GameSpec ejecutable: resuelve las fábricas
 * (lazy para Hard) y construye la variante de reglas. Corre dentro del worker.
 */
export async function materializeSpec(d: GameSpecDescriptor): Promise<GameSpec> {
  const players = {} as GameSpec["players"];
  for (const p of [Player.BLANCAS, Player.NEGRAS]) {
    const ref = d.players[p];
    const factory = await loadBotFactory(ref.bot);
    const personality: Personality = ref.personality ?? "balanced";
    players[p] = {
      spec: playerSpecOf(ref),
      create: (rng: Rng) => factory(rng, { personality }),
    };
  }
  return {
    id: d.id,
    batchId: d.batchId,
    seed: d.seed,
    gitSha: d.gitSha,
    variant: buildVariant(d.variant),
    players,
    setupMode: d.setupMode,
    opening: d.opening,
    maxPlies: d.maxPlies,
    recordPositions: d.recordPositions,
  };
}
