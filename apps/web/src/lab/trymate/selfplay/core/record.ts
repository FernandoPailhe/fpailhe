import { PieceType, Player } from "../../domain/constants/PieceConstants";
import type { PieceMovementConfigMap } from "../../domain/constants/PieceConstants";
import { buildRulesView, type RulesView } from "../../domain/config/RulesView";

/**
 * Formato versionado de una partida grabada (`trymate.game/1`).
 * Compatible = agregar campos opcionales; incompatible = `trymate.game/2` y un
 * lector que soporte ambas. Nunca reinterpretar un campo existente.
 */
export const GAME_RECORD_SCHEMA = "trymate.game/1" as const;

export interface PlayerSpec {
  bot: string;
  difficulty: string;
  personality?: string;
  budget?: { kind: "nodes"; n: number };
  /** Hash de la config efectiva del bot (pesos, multiplicadores). */
  configHash: string;
}

export interface SideMetrics {
  avgFrontProgress: number;
  maxProgress: number;
  pliesToFirstScore: number | null;
  capturesMade: number;
  piecesLost: number;
  opponentMaxProgress: number;
  benchDrops: number;
  randomActions: number;
}

export interface RulesViewSnapshot {
  width: number;
  height: number;
  pieceTypes: string[];
  piecesToPlace: number;
  benchSize: number;
  minPerType: number;
  maxPerType: number;
  maxPerRow: number;
  pointsToWin: number;
  placementRows: Record<Player, number[]>;
}

export interface PlyRecord {
  n: number;
  player: Player;
  kind: "move" | "bench" | "pass";
  pieceId?: string;
  type?: PieceType;
  from?: [number, number];
  to?: [number, number];
  capture?: PieceType;
  scored?: boolean;
  random?: boolean;
  decision?: {
    eval?: number;
    depth?: number;
    nodes?: number;
    ms?: number;
    posture?: string;
    top?: { a: string; s: number }[];
  };
  /** Posición ANTES de la acción, codificada (positionCodec). */
  pos?: string;
}

export interface GameRecord {
  schema: typeof GAME_RECORD_SCHEMA;
  id: string;
  batchId: string;
  seed: number;
  createdAt: string;
  gitSha: string | null;
  rules: {
    fingerprint: string;
    variant: string;
    view: RulesViewSnapshot;
    pieceConfig: PieceMovementConfigMap;
  };
  players: Record<Player, PlayerSpec>;
  setupMode: "ALTERNATING" | "HIDDEN" | "RANDOM";
  setup: Record<
    Player,
    { board: { type: PieceType; x: number; y: number }[]; bench: PieceType[]; order: number[] }
  >;
  opening: { randomPlies: number; epsilon: number; randomActions: number[] };
  plies: PlyRecord[];
  result: {
    winner: Player | null;
    scores: Record<Player, number>;
    reason: "points" | "blocked" | "maxPlies";
    plies: number;
    durationMs: number;
  };
  metrics: Record<Player, SideMetrics>;
}

const PLAYERS = [Player.BLANCAS, Player.NEGRAS] as const;
const SETUP_MODES = ["ALTERNATING", "HIDDEN", "RANDOM"] as const;
const END_REASONS = ["points", "blocked", "maxPlies"] as const;
const PLY_KINDS = ["move", "bench", "pass"] as const;

/** RulesView → snapshot serializable (sin funciones). */
export function snapshotRules(rules: RulesView): RulesViewSnapshot {
  return {
    width: rules.width,
    height: rules.height,
    pieceTypes: [...rules.pieceTypes],
    piecesToPlace: rules.piecesToPlace,
    benchSize: rules.benchSize,
    minPerType: rules.minPerType,
    maxPerType: rules.maxPerType,
    maxPerRow: rules.maxPerRow,
    pointsToWin: rules.pointsToWin,
    placementRows: {
      [Player.BLANCAS]: [...rules.placementRows(Player.BLANCAS)],
      [Player.NEGRAS]: [...rules.placementRows(Player.NEGRAS)],
    },
  };
}

/** Reconstruye una RulesView desde el snapshot (misma fórmula que el dominio). */
export function rulesFromSnapshot(s: RulesViewSnapshot): RulesView {
  return buildRulesView(
    { BOARD_WIDTH: s.width, BOARD_HEIGHT: s.height },
    {
      PIECES_TO_PLACE: s.piecesToPlace,
      PIECES_IN_BENCH: s.benchSize,
      MIN_PIECES_PER_TYPE: s.minPerType,
      MAX_PIECES_PER_TYPE: s.maxPerType,
      MAX_PIECES_PER_ROW: s.maxPerRow,
      POINTS_TO_WIN: s.pointsToWin,
      PLACEMENT_DEPTH: s.placementRows[Player.BLANCAS].length,
    },
    s.pieceTypes as PieceType[],
  );
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isIntArr = (v: unknown): v is number[] => Array.isArray(v) && v.every(isInt);

function checkCoord(v: unknown, view: RulesViewSnapshot, label: string, errors: string[]): void {
  if (!Array.isArray(v) || v.length !== 2 || !isInt(v[0]) || !isInt(v[1])) {
    errors.push(`${label}: coordenada inválida`);
    return;
  }
  if (v[0] < 0 || v[0] >= view.width || v[1] < 0 || v[1] >= view.height) {
    errors.push(`${label}: (${v[0]},${v[1]}) fuera del tablero ${view.width}×${view.height}`);
  }
}

function checkSideMetrics(v: unknown, label: string, errors: string[]): void {
  if (!isObj(v)) {
    errors.push(`${label}: no es objeto`);
    return;
  }
  for (const k of [
    "avgFrontProgress",
    "maxProgress",
    "capturesMade",
    "piecesLost",
    "opponentMaxProgress",
    "benchDrops",
    "randomActions",
  ]) {
    if (!isNum(v[k])) errors.push(`${label}.${k}: falta o no es número`);
  }
  if (!(isNum(v.pliesToFirstScore) || v.pliesToFirstScore === null)) {
    errors.push(`${label}.pliesToFirstScore: debe ser número o null`);
  }
}

function checkPlayerSpec(v: unknown, label: string, errors: string[]): void {
  if (!isObj(v)) {
    errors.push(`${label}: no es objeto`);
    return;
  }
  if (!isStr(v.bot) || v.bot === "") errors.push(`${label}.bot: falta`);
  if (!isStr(v.difficulty) || v.difficulty === "") errors.push(`${label}.difficulty: falta`);
  if (!isStr(v.configHash)) errors.push(`${label}.configHash: falta`);
  if (v.personality !== undefined && !isStr(v.personality))
    errors.push(`${label}.personality: debe ser string`);
  if (v.budget !== undefined) {
    if (!isObj(v.budget) || v.budget.kind !== "nodes" || !isInt(v.budget.n) || v.budget.n <= 0)
      errors.push(`${label}.budget: debe ser { kind: "nodes", n > 0 }`);
  }
}

function checkView(v: unknown, errors: string[]): RulesViewSnapshot | null {
  if (!isObj(v)) {
    errors.push("rules.view: no es objeto");
    return null;
  }
  for (const k of [
    "width",
    "height",
    "piecesToPlace",
    "benchSize",
    "minPerType",
    "maxPerType",
    "maxPerRow",
    "pointsToWin",
  ]) {
    if (!isInt(v[k]) || (v[k] as number) <= 0) errors.push(`rules.view.${k}: falta o inválido`);
  }
  if (!Array.isArray(v.pieceTypes) || v.pieceTypes.length === 0 || !v.pieceTypes.every(isStr)) {
    errors.push("rules.view.pieceTypes: debe ser array de strings no vacío");
  }
  if (!isObj(v.placementRows)) {
    errors.push("rules.view.placementRows: no es objeto");
  } else {
    for (const p of PLAYERS) {
      if (!isIntArr(v.placementRows[p]))
        errors.push(`rules.view.placementRows.${p}: debe ser array de enteros`);
    }
  }
  return errors.length ? null : (v as unknown as RulesViewSnapshot);
}

function checkPly(v: unknown, i: number, view: RulesViewSnapshot, errors: string[]): void {
  const label = `plies[${i}]`;
  if (!isObj(v)) {
    errors.push(`${label}: no es objeto`);
    return;
  }
  if (!isInt(v.n) || v.n !== i) errors.push(`${label}.n: esperado ${i}`);
  if (!PLAYERS.includes(v.player as Player)) errors.push(`${label}.player: inválido`);
  if (!PLY_KINDS.includes(v.kind as PlyRecord["kind"])) errors.push(`${label}.kind: inválido`);
  if (v.pieceId !== undefined && !isStr(v.pieceId))
    errors.push(`${label}.pieceId: debe ser string`);
  if (v.type !== undefined && !view.pieceTypes.includes(v.type as string))
    errors.push(`${label}.type: no está en pieceTypes`);
  if (v.capture !== undefined && !view.pieceTypes.includes(v.capture as string))
    errors.push(`${label}.capture: no está en pieceTypes`);
  if (v.from !== undefined) checkCoord(v.from, view, `${label}.from`, errors);
  if (v.to !== undefined) checkCoord(v.to, view, `${label}.to`, errors);
  if (v.scored !== undefined && typeof v.scored !== "boolean")
    errors.push(`${label}.scored: debe ser boolean`);
  if (v.random !== undefined && typeof v.random !== "boolean")
    errors.push(`${label}.random: debe ser boolean`);
  if (v.pos !== undefined && !isStr(v.pos)) errors.push(`${label}.pos: debe ser string`);
  if (v.decision !== undefined) {
    if (!isObj(v.decision)) errors.push(`${label}.decision: no es objeto`);
    else {
      for (const k of ["eval", "depth", "nodes", "ms"]) {
        if (v.decision[k] !== undefined && !isNum(v.decision[k]))
          errors.push(`${label}.decision.${k}: debe ser número`);
      }
      if (v.decision.posture !== undefined && !isStr(v.decision.posture))
        errors.push(`${label}.decision.posture: debe ser string`);
      if (v.decision.top !== undefined) {
        const top = v.decision.top;
        if (!Array.isArray(top) || !top.every((t) => isObj(t) && isStr(t.a) && isNum(t.s)))
          errors.push(`${label}.decision.top: debe ser { a: string; s: number }[]`);
      }
    }
  }
}

/**
 * Validación manual del formato `trymate.game/1` (sin librerías). Devuelve el
 * registro tipado si es válido o la lista de errores encontrados.
 */
export function validateGameRecord(
  value: unknown,
): { ok: true; record: GameRecord } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(value)) return { ok: false, errors: ["no es un objeto"] };
  const r = value;

  if (r.schema !== GAME_RECORD_SCHEMA) errors.push(`schema: esperado "${GAME_RECORD_SCHEMA}"`);
  if (!isStr(r.id) || r.id === "") errors.push("id: falta");
  if (!isStr(r.batchId) || r.batchId === "") errors.push("batchId: falta");
  if (!isInt(r.seed)) errors.push("seed: debe ser entero");
  if (!isStr(r.createdAt)) errors.push("createdAt: falta");
  if (!(r.gitSha === null || isStr(r.gitSha))) errors.push("gitSha: debe ser string o null");

  let view: RulesViewSnapshot | null = null;
  if (!isObj(r.rules)) {
    errors.push("rules: no es objeto");
  } else {
    if (!isStr(r.rules.fingerprint)) errors.push("rules.fingerprint: falta");
    if (!isStr(r.rules.variant)) errors.push("rules.variant: falta");
    if (!isObj(r.rules.pieceConfig)) errors.push("rules.pieceConfig: no es objeto");
    view = checkView(r.rules.view, errors);
  }

  if (!isObj(r.players)) {
    errors.push("players: no es objeto");
  } else {
    for (const p of PLAYERS) checkPlayerSpec(r.players[p], `players.${p}`, errors);
  }

  if (!SETUP_MODES.includes(r.setupMode as GameRecord["setupMode"]))
    errors.push("setupMode: inválido");

  if (!isObj(r.setup)) {
    errors.push("setup: no es objeto");
  } else if (view) {
    for (const p of PLAYERS) {
      const s = r.setup[p];
      const label = `setup.${p}`;
      if (!isObj(s)) {
        errors.push(`${label}: falta`);
        continue;
      }
      if (!Array.isArray(s.board)) {
        errors.push(`${label}.board: debe ser array`);
      } else {
        for (const [i, pc] of s.board.entries()) {
          const pl = `${label}.board[${i}]`;
          if (!isObj(pc)) {
            errors.push(`${pl}: no es objeto`);
            continue;
          }
          if (!view.pieceTypes.includes(pc.type as string))
            errors.push(`${pl}.type: no está en pieceTypes`);
          checkCoord([pc.x, pc.y], view, pl, errors);
        }
      }
      if (!Array.isArray(s.bench) || !s.bench.every((t) => view.pieceTypes.includes(t as string)))
        errors.push(`${label}.bench: tipos inválidos`);
      if (!isIntArr(s.order)) errors.push(`${label}.order: debe ser array de enteros`);
    }
  }

  if (!isObj(r.opening)) {
    errors.push("opening: no es objeto");
  } else {
    if (!isInt(r.opening.randomPlies) || r.opening.randomPlies < 0)
      errors.push("opening.randomPlies: debe ser entero ≥0");
    if (!isNum(r.opening.epsilon) || r.opening.epsilon < 0 || r.opening.epsilon > 1)
      errors.push("opening.epsilon: debe estar en [0,1]");
    if (!isIntArr(r.opening.randomActions))
      errors.push("opening.randomActions: debe ser array de enteros");
  }

  const plies = r.plies;
  if (!Array.isArray(plies)) {
    errors.push("plies: debe ser array");
  } else if (view) {
    for (const [i, ply] of plies.entries()) checkPly(ply, i, view, errors);
  }

  if (!isObj(r.result)) {
    errors.push("result: no es objeto");
  } else {
    if (!(r.result.winner === null || PLAYERS.includes(r.result.winner as Player)))
      errors.push("result.winner: inválido");
    if (!isObj(r.result.scores)) {
      errors.push("result.scores: no es objeto");
    } else {
      for (const p of PLAYERS) {
        if (!isInt(r.result.scores[p]) || (r.result.scores[p] as number) < 0)
          errors.push(`result.scores.${p}: debe ser entero ≥0`);
      }
    }
    if (!END_REASONS.includes(r.result.reason as GameRecord["result"]["reason"]))
      errors.push("result.reason: inválido");
    if (Array.isArray(plies) && r.result.plies !== plies.length)
      errors.push(`result.plies (${String(r.result.plies)}) !== plies.length (${plies.length})`);
    if (!isNum(r.result.durationMs) || r.result.durationMs < 0)
      errors.push("result.durationMs: debe ser número ≥0");
  }

  if (!isObj(r.metrics)) {
    errors.push("metrics: no es objeto");
  } else {
    for (const p of PLAYERS) checkSideMetrics(r.metrics[p], `metrics.${p}`, errors);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, record: r as unknown as GameRecord };
}
