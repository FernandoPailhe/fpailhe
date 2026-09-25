import { Player, type PieceType } from "../../domain/constants/PieceConstants";
import { stableConfigHash } from "./experiment";
import type { GameRecord, SideMetrics } from "./record";
import { applyRecordedPly, initialSimFromRecord } from "./replay";
import { histogram, mean, percentiles, stdev, wilson, type Histogram, type Wilson } from "./stats";

/**
 * Agregación incremental de un batch (`trymate.summary/1`). Recorre cada
 * registro una sola vez reconstruyendo el estado con el árbitro de replay; la
 * memoria crece con los grupos, no con la cantidad de partidas.
 */

export const SUMMARY_SCHEMA = "trymate.summary/1" as const;
const CALIBRATION_PLIES = [10, 20, 40] as const;
const CAL_BINS = 5;
const PLIES_BINS = 12;
export const MIN_GROUP_N = 200;

const PLAYERS = [Player.BLANCAS, Player.NEGRAS] as const;

export interface CountWin {
  n: number;
  wins: number;
}

export interface PieceSummary {
  deployed: number;
  survived: number;
  capturesMade: number;
  capturesSuffered: number;
  pointsScored: number;
  /** Promedio de ply en que el tipo anotó (null si nunca). */
  pliesToScore: number | null;
  benchDrops: number;
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  n: number;
  /** % de victoria del bando que evaluó. */
  winRate: number;
}

export interface GroupSummary {
  n: number;
  winsByColor: Record<Player, { wins: number; share: Wilson }>;
  draws: { n: number; share: Wilson };
  reasons: Record<string, number>;
  plies: { mean: number; stdev: number; p10: number; p50: number; p90: number; hist: Histogram };
  /** De partidas con al menos un tanto: % en que ganó quien anotó primero. */
  firstScorerWins: { n: number; share: Wilson } | null;
  /** De partidas con ganador y primer tanto: % en que ganó quien cedió el primer tanto. */
  comebackRate: { n: number; share: Wilson } | null;
  /** Clave "<tipo>:<n>,…|bench:<…>" — n y victorias del bando con esa composición. */
  byComposition: Record<string, CountWin>;
  /** Clave "<front>-<mid>-<back>" de filas de despliegue — n y victorias por bando. */
  byFormation: Record<string, CountWin>;
  pieces: Record<string, PieceSummary>;
  captureMatrix: Record<string, Record<string, number>>;
  /** null si el grupo mezcla tableros de distinto tamaño. */
  heatmaps: { occupancy: number[][]; captures: number[][]; scoringColumns: number[] } | null;
  bench: {
    /** Bajadas totales por partida (ambos bandos). */
    dropsPerGame: number;
    avgDropPly: number | null;
    /** n/wins del bando según su cantidad de bajadas. */
    byCount: Record<string, CountWin>;
  };
  personalities: {
    /** "<persBlancas>×<persNegras>". */
    matrix: Record<string, { n: number; wins: Record<Player, number> }>;
    /** Promedio de SideMetrics por personalidad (por bando). */
    side: Record<string, { n: number; metrics: SideMetrics }>;
  };
  /** Por ply {10,20,40}: quintiles de decision.eval → % de victoria del evaluador. */
  calibration: Record<string, CalibrationBin[]>;
  randomOpeningShare: number;
  /** Partidas con secuencia de acciones repetida. */
  duplicates: { games: number; clusters: number };
}

export interface Summary {
  schema: typeof SUMMARY_SCHEMA;
  batchId: string;
  generatedAt: string;
  games: number;
  failures: number;
  groups: Record<string, GroupSummary>;
  warnings: string[];
}

// ---------- acumuladores internos ----------

interface PieceAcc {
  deployed: number;
  survived: number;
  capturesMade: number;
  capturesSuffered: number;
  pointsScored: number;
  pliesToScore: number[];
  benchDrops: number;
}

const newPieceAcc = (): PieceAcc => ({
  deployed: 0,
  survived: 0,
  capturesMade: 0,
  capturesSuffered: 0,
  pointsScored: 0,
  pliesToScore: [],
  benchDrops: 0,
});

const SIDE_KEYS = [
  "avgFrontProgress",
  "maxProgress",
  "pliesToFirstScore",
  "capturesMade",
  "piecesLost",
  "opponentMaxProgress",
  "benchDrops",
  "randomActions",
] as const;

interface SideAcc {
  n: number;
  /** partidas donde pliesToFirstScore no fue null. */
  firstScoreN: number;
  sums: Record<(typeof SIDE_KEYS)[number], number>;
}

const newSideAcc = (): SideAcc => ({
  n: 0,
  firstScoreN: 0,
  sums: {
    avgFrontProgress: 0,
    maxProgress: 0,
    pliesToFirstScore: 0,
    capturesMade: 0,
    piecesLost: 0,
    opponentMaxProgress: 0,
    benchDrops: 0,
    randomActions: 0,
  },
});

interface GroupAcc {
  n: number;
  wins: Record<Player, number>;
  draws: number;
  reasons: Map<string, number>;
  plies: number[];
  scoredGames: number;
  firstScorerWins: number;
  comebacks: number;
  comp: Map<string, CountWin>;
  formation: Map<string, CountWin>;
  pieces: Map<string, PieceAcc>;
  capMatrix: Map<string, Map<string, number>>;
  dims: { w: number; h: number } | null;
  dimsMixed: boolean;
  occ: number[];
  caps: number[];
  scoreCols: number[];
  dropsPerGame: number[];
  dropPlySum: number;
  dropPlyN: number;
  dropsByCount: Map<number, CountWin>;
  persMatrix: Map<string, { n: number; winsW: number; winsN: number }>;
  persSide: Map<string, SideAcc>;
  cal: Map<number, { e: number; won: boolean }[]>;
  randomPlies: number;
  totalPlies: number;
  seq: Map<string, number>;
}

const newGroupAcc = (): GroupAcc => ({
  n: 0,
  wins: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
  draws: 0,
  reasons: new Map(),
  plies: [],
  scoredGames: 0,
  firstScorerWins: 0,
  comebacks: 0,
  comp: new Map(),
  formation: new Map(),
  pieces: new Map(),
  capMatrix: new Map(),
  dims: null,
  dimsMixed: false,
  occ: [],
  caps: [],
  scoreCols: [],
  dropsPerGame: [],
  dropPlySum: 0,
  dropPlyN: 0,
  dropsByCount: new Map(),
  persMatrix: new Map(),
  persSide: new Map(),
  cal: new Map(),
  randomPlies: 0,
  totalPlies: 0,
  seq: new Map(),
});

// ---------- extracción por registro ----------

const bump = (m: Map<number, number>, k: number): void => {
  m.set(k, (m.get(k) ?? 0) + 1);
};

const personalityOf = (r: GameRecord, p: Player): string => r.players[p].personality ?? "balanced";

const botLabel = (r: GameRecord, p: Player): string => {
  const s = r.players[p];
  const pers = s.personality ? `:${s.personality}` : "";
  const budget = s.budget ? `@${s.budget.n}` : "";
  return `${s.bot}${pers}${budget}`;
};

/** "front-mid-back": filas de despliegue ordenadas por cercanía a la fila de anotación. */
function formationKey(r: GameRecord, p: Player): string {
  const view = r.rules.view;
  const scoringRow = p === Player.BLANCAS ? view.height - 1 : 0;
  const rows = [...view.placementRows[p]].sort(
    (a, b) => Math.abs(a - scoringRow) - Math.abs(b - scoringRow),
  );
  const band = new Map<number, number>();
  rows.forEach((row, rank) => band.set(row, Math.min(2, Math.floor((rank * 3) / rows.length))));
  const counts = [0, 0, 0];
  for (const pc of r.setup[p].board) {
    const b = band.get(pc.y);
    if (b !== undefined) counts[b]! += 1;
  }
  return counts.join("-");
}

/** "<tipo>:<n>,…|bench:<…>" con tipos ordenados. */
function compositionKey(r: GameRecord, p: Player): string {
  const onBoard = new Map<string, number>();
  for (const pc of r.setup[p].board) onBoard.set(pc.type, (onBoard.get(pc.type) ?? 0) + 1);
  const boardPart = [...onBoard.keys()]
    .sort()
    .map((t) => `${t}:${onBoard.get(t)}`)
    .join(",");
  const benchPart = [...r.setup[p].bench].sort().join(",");
  return `${boardPart}|bench:${benchPart}`;
}

interface RecordInfo {
  nPlies: number;
  firstScorer: Player | null;
  randomPlies: number;
  occ: Map<number, number>;
  caps: Map<number, number>;
  scoreCols: Map<number, number>;
  capMatrix: Map<string, Map<string, number>>;
  pieces: Map<string, PieceAcc>;
  dropPlyIdx: number[];
  dropsByPlayer: Record<Player, number>;
  cal: { ply: number; e: number; player: Player }[];
  seqHash: string;
}

/** Recorre los plies una vez con el árbitro de replay y extrae todos los deltas. */
function analyzeRecord(r: GameRecord): RecordInfo {
  const frame = initialSimFromRecord(r);
  const w = r.rules.view.width;
  const info: RecordInfo = {
    nPlies: r.plies.length,
    firstScorer: null,
    randomPlies: 0,
    occ: new Map(),
    caps: new Map(),
    scoreCols: new Map(),
    capMatrix: new Map(),
    pieces: new Map(),
    dropPlyIdx: [],
    dropsByPlayer: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    cal: [],
    seqHash: stableConfigHash(
      r.plies.map((p) => [p.kind, p.pieceId ?? "", p.type ?? "", p.to ?? ""]),
    ),
  };
  const pieceAcc = (t: PieceType): PieceAcc => {
    let a = info.pieces.get(t);
    if (!a) info.pieces.set(t, (a = newPieceAcc()));
    return a;
  };

  const addOccupancy = (): void => {
    for (const pc of frame.state.board.getAllPieces()) {
      const pos = pc.position;
      if (pos) bump(info.occ, pos.y * w + pos.x);
    }
  };
  addOccupancy(); // posición de setup

  for (const ply of r.plies) {
    if (ply.random) info.randomPlies += 1;
    if (ply.scored && info.firstScorer === null) info.firstScorer = ply.player;
    if (
      ply.decision?.eval !== undefined &&
      (CALIBRATION_PLIES as readonly number[]).includes(ply.n)
    ) {
      info.cal.push({ ply: ply.n, e: ply.decision.eval, player: ply.player });
    }
    if (ply.kind === "bench" && ply.type) {
      info.dropPlyIdx.push(ply.n);
      info.dropsByPlayer[ply.player] += 1;
      pieceAcc(ply.type).benchDrops += 1;
    }
    if (ply.kind === "move") {
      const mover = frame.state.board.getAllPieces().find((pc) => pc.id === ply.pieceId);
      if (mover && ply.capture) {
        const sub = info.capMatrix.get(mover.type) ?? new Map<string, number>();
        sub.set(ply.capture, (sub.get(ply.capture) ?? 0) + 1);
        info.capMatrix.set(mover.type, sub);
        pieceAcc(mover.type).capturesMade += 1;
        pieceAcc(ply.capture).capturesSuffered += 1;
      }
      if (ply.capture && ply.to) bump(info.caps, ply.to[1] * w + ply.to[0]);
      if (ply.scored && ply.to) {
        bump(info.scoreCols, ply.to[0]);
        if (mover) {
          pieceAcc(mover.type).pointsScored += 1;
          pieceAcc(mover.type).pliesToScore.push(ply.n);
        }
      }
    }
    const applied = applyRecordedPly(frame, ply);
    if (!applied.ok) break; // registro corrupto: no se puede seguir recorriendo
    frame.state = applied.state;
    addOccupancy();
  }

  for (const pc of frame.state.board.getAllPieces()) {
    if (pc.position) pieceAcc(pc.type).survived += 1;
  }
  for (const p of PLAYERS) for (const pc of r.setup[p].board) pieceAcc(pc.type).deployed += 1;
  return info;
}

// ---------- aplicación a grupos ----------

const groupKeys = (r: GameRecord): string[] => {
  const fp = stableConfigHash(r.rules.fingerprint).slice(0, 8);
  const v = `variant:${r.rules.variant}@${fp}`;
  const matchup = `${botLabel(r, Player.BLANCAS)}vs${botLabel(r, Player.NEGRAS)}`;
  return ["all", v, `${v}|matchup:${matchup}`, `${v}|setup:${r.setupMode}`];
};

const mergePieces = (dst: Map<string, PieceAcc>, src: Map<string, PieceAcc>): void => {
  for (const [t, s] of src) {
    let d = dst.get(t);
    if (!d) dst.set(t, (d = newPieceAcc()));
    d.deployed += s.deployed;
    d.survived += s.survived;
    d.capturesMade += s.capturesMade;
    d.capturesSuffered += s.capturesSuffered;
    d.pointsScored += s.pointsScored;
    d.benchDrops += s.benchDrops;
    for (const n of s.pliesToScore) d.pliesToScore.push(n);
  }
};

const bumpCountWin = (m: Map<string, CountWin>, key: string, won: boolean): void => {
  let c = m.get(key);
  if (!c) m.set(key, (c = { n: 0, wins: 0 }));
  c.n += 1;
  if (won) c.wins += 1;
};

function applyToGroup(g: GroupAcc, r: GameRecord, info: RecordInfo): void {
  g.n += 1;
  const winner = r.result.winner;
  if (winner) g.wins[winner] += 1;
  else g.draws += 1;
  g.reasons.set(r.result.reason, (g.reasons.get(r.result.reason) ?? 0) + 1);
  g.plies.push(info.nPlies);

  if (info.firstScorer !== null) {
    g.scoredGames += 1;
    if (info.firstScorer === winner) g.firstScorerWins += 1;
    if (winner && winner !== info.firstScorer) g.comebacks += 1;
  }

  for (const p of PLAYERS) {
    bumpCountWin(g.comp, compositionKey(r, p), winner === p);
    bumpCountWin(g.formation, formationKey(r, p), winner === p);
    const drops = info.dropsByPlayer[p];
    let dc = g.dropsByCount.get(drops);
    if (!dc) g.dropsByCount.set(drops, (dc = { n: 0, wins: 0 }));
    dc.n += 1;
    if (winner === p) dc.wins += 1;

    const pers = personalityOf(r, p);
    let sa = g.persSide.get(pers);
    if (!sa) g.persSide.set(pers, (sa = newSideAcc()));
    const m = r.metrics[p];
    sa.n += 1;
    for (const k of SIDE_KEYS) {
      if (k === "pliesToFirstScore") {
        if (m.pliesToFirstScore !== null) {
          sa.firstScoreN += 1;
          sa.sums.pliesToFirstScore += m.pliesToFirstScore;
        }
      } else {
        sa.sums[k] += m[k];
      }
    }
  }

  mergePieces(g.pieces, info.pieces);
  for (const [captor, victims] of info.capMatrix) {
    const sub = g.capMatrix.get(captor) ?? new Map<string, number>();
    for (const [v, n] of victims) sub.set(v, (sub.get(v) ?? 0) + n);
    g.capMatrix.set(captor, sub);
  }

  const { width: w, height: h } = r.rules.view;
  if (g.dims === null) g.dims = { w, h };
  else if (g.dims.w !== w || g.dims.h !== h) g.dimsMixed = true;
  if (!g.dimsMixed) {
    if (g.occ.length === 0) {
      g.occ = new Array<number>(w * h).fill(0);
      g.caps = new Array<number>(w * h).fill(0);
      g.scoreCols = new Array<number>(w).fill(0);
    }
    for (const [idx, n] of info.occ) g.occ[idx]! += n;
    for (const [idx, n] of info.caps) g.caps[idx]! += n;
    for (const [x, n] of info.scoreCols) g.scoreCols[x]! += n;
  }

  g.dropsPerGame.push(info.dropPlyIdx.length);
  for (const n of info.dropPlyIdx) {
    g.dropPlySum += n;
    g.dropPlyN += 1;
  }

  const mk = `${personalityOf(r, Player.BLANCAS)}×${personalityOf(r, Player.NEGRAS)}`;
  let pm = g.persMatrix.get(mk);
  if (!pm) g.persMatrix.set(mk, (pm = { n: 0, winsW: 0, winsN: 0 }));
  pm.n += 1;
  if (winner === Player.BLANCAS) pm.winsW += 1;
  if (winner === Player.NEGRAS) pm.winsN += 1;

  for (const s of info.cal) {
    let arr = g.cal.get(s.ply);
    if (!arr) g.cal.set(s.ply, (arr = []));
    arr.push({ e: s.e, won: s.player === winner });
  }

  g.randomPlies += info.randomPlies;
  g.totalPlies += info.nPlies;
  g.seq.set(info.seqHash, (g.seq.get(info.seqHash) ?? 0) + 1);
}

// ---------- materialización ----------

const matrix = <T>(flat: number[], w: number, h: number): T => {
  const rows: number[][] = [];
  for (let y = 0; y < h; y++) rows.push(flat.slice(y * w, (y + 1) * w));
  return rows as T;
};

const recOfCounts = (m: Map<string, number>): Record<string, number> =>
  Object.fromEntries([...m.entries()].sort(([a], [b]) => a.localeCompare(b)));

const calBins = (samples: { e: number; won: boolean }[]): CalibrationBin[] => {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a.e - b.e);
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < CAL_BINS; i++) {
    const lo = Math.round((i * sorted.length) / CAL_BINS);
    const hi = Math.round(((i + 1) * sorted.length) / CAL_BINS);
    const slice = sorted.slice(lo, hi);
    if (slice.length === 0) continue;
    bins.push({
      lo: slice[0]!.e,
      hi: slice[slice.length - 1]!.e,
      n: slice.length,
      winRate: mean(slice.map((s) => (s.won ? 1 : 0))),
    });
  }
  return bins;
};

function materialize(g: GroupAcc): GroupSummary {
  const [p10 = 0, p50 = 0, p90 = 0] = percentiles(g.plies, [10, 50, 90]);
  const { w = 0, h = 0 } = g.dims ?? {};
  let dupGames = 0;
  let dupClusters = 0;
  for (const c of g.seq.values()) {
    if (c > 1) {
      dupGames += c;
      dupClusters += 1;
    }
  }
  const pieces: Record<string, PieceSummary> = {};
  for (const [t, a] of [...g.pieces.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    pieces[t] = {
      deployed: a.deployed,
      survived: a.survived,
      capturesMade: a.capturesMade,
      capturesSuffered: a.capturesSuffered,
      pointsScored: a.pointsScored,
      pliesToScore: a.pliesToScore.length ? mean(a.pliesToScore) : null,
      benchDrops: a.benchDrops,
    };
  }
  const capMatrix: Record<string, Record<string, number>> = {};
  for (const [captor, victims] of [...g.capMatrix.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    capMatrix[captor] = recOfCounts(victims);
  }
  const persSide: Record<string, { n: number; metrics: SideMetrics }> = {};
  for (const [pers, a] of g.persSide) {
    persSide[pers] = {
      n: a.n,
      metrics: {
        avgFrontProgress: a.sums.avgFrontProgress / a.n,
        maxProgress: a.sums.maxProgress / a.n,
        pliesToFirstScore: a.firstScoreN ? a.sums.pliesToFirstScore / a.firstScoreN : null,
        capturesMade: a.sums.capturesMade / a.n,
        piecesLost: a.sums.piecesLost / a.n,
        opponentMaxProgress: a.sums.opponentMaxProgress / a.n,
        benchDrops: a.sums.benchDrops / a.n,
        randomActions: a.sums.randomActions / a.n,
      },
    };
  }
  const calibration: Record<string, CalibrationBin[]> = {};
  for (const [ply, samples] of g.cal) calibration[String(ply)] = calBins(samples);
  const dropsByCount: Record<string, CountWin> = {};
  for (const [k, v] of [...g.dropsByCount.entries()].sort((a, b) => a[0] - b[0])) {
    dropsByCount[String(k)] = v;
  }
  return {
    n: g.n,
    winsByColor: {
      [Player.BLANCAS]: {
        wins: g.wins[Player.BLANCAS],
        share: wilson(g.wins[Player.BLANCAS], g.n),
      },
      [Player.NEGRAS]: { wins: g.wins[Player.NEGRAS], share: wilson(g.wins[Player.NEGRAS], g.n) },
    },
    draws: { n: g.draws, share: wilson(g.draws, g.n) },
    reasons: recOfCounts(g.reasons),
    plies: {
      mean: mean(g.plies),
      stdev: stdev(g.plies),
      p10,
      p50,
      p90,
      hist: histogram(g.plies, PLIES_BINS),
    },
    firstScorerWins:
      g.scoredGames > 0
        ? { n: g.scoredGames, share: wilson(g.firstScorerWins, g.scoredGames) }
        : null,
    comebackRate:
      g.scoredGames > 0 ? { n: g.scoredGames, share: wilson(g.comebacks, g.scoredGames) } : null,
    byComposition: Object.fromEntries([...g.comp.entries()].sort(([a], [b]) => a.localeCompare(b))),
    byFormation: Object.fromEntries(
      [...g.formation.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    pieces,
    captureMatrix: capMatrix,
    heatmaps: g.dimsMixed
      ? null
      : {
          occupancy: matrix(g.occ, w, h),
          captures: matrix(g.caps, w, h),
          scoringColumns: g.scoreCols,
        },
    bench: {
      dropsPerGame: mean(g.dropsPerGame),
      avgDropPly: g.dropPlyN ? g.dropPlySum / g.dropPlyN : null,
      byCount: dropsByCount,
    },
    personalities: {
      matrix: Object.fromEntries(
        [...g.persMatrix.entries()].map(([k, v]) => [
          k,
          { n: v.n, wins: { [Player.BLANCAS]: v.winsW, [Player.NEGRAS]: v.winsN } },
        ]),
      ),
      side: persSide,
    },
    calibration,
    randomOpeningShare: g.totalPlies ? g.randomPlies / g.totalPlies : 0,
    duplicates: { games: dupGames, clusters: dupClusters },
  };
}

// ---------- API ----------

export interface Aggregator {
  add(r: GameRecord): void;
  /** Registra fallas del batch (líneas inválidas + failures.jsonl). */
  noteFailures(n: number): void;
  finish(): Summary;
}

export function createAggregator(): Aggregator {
  const groups = new Map<string, GroupAcc>();
  const batchIds = new Set<string>();
  let failures = 0;
  return {
    add(r) {
      batchIds.add(r.batchId);
      const info = analyzeRecord(r);
      for (const key of groupKeys(r)) {
        let g = groups.get(key);
        if (!g) groups.set(key, (g = newGroupAcc()));
        applyToGroup(g, r, info);
      }
    },
    noteFailures(n) {
      failures += n;
    },
    finish() {
      const out: Record<string, GroupSummary> = {};
      for (const [k, g] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        out[k] = materialize(g);
      }
      const warnings: string[] = [];
      for (const [k, s] of Object.entries(out)) {
        if (s.n < MIN_GROUP_N) warnings.push(`grupo "${k}": n=${s.n} (< ${MIN_GROUP_N})`);
        if (s.n > 0 && s.duplicates.games / s.n > 0.01) {
          warnings.push(
            `grupo "${k}": ${((100 * s.duplicates.games) / s.n).toFixed(1)}% de partidas duplicadas`,
          );
        }
        const maxPlies = s.reasons["maxPlies"] ?? 0;
        if (s.n > 0 && maxPlies / s.n > 0.05) {
          warnings.push(
            `grupo "${k}": ${((100 * maxPlies) / s.n).toFixed(1)}% terminaron por maxPlies`,
          );
        }
      }
      return {
        schema: SUMMARY_SCHEMA,
        batchId: [...batchIds].sort().join("+"),
        generatedAt: new Date().toISOString(),
        games: out["all"]?.n ?? 0,
        failures,
        groups: out,
        warnings,
      };
    },
  };
}
