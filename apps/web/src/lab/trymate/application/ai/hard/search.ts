import { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import { analyzeBoard } from "../analysis/boardAnalysis";
import type { RulesInsight } from "../introspection/profiles";
import { MEDIUM_BOT_CONFIG } from "../medium/config";
import { choosePosture } from "../medium/posture";
import { opponentOf } from "../sim/SimState";
import type { Rng } from "../rng";
import { evaluateHard, type PostureSpec, type SideMultipliers } from "./evaluation";
import type { PersonalityProfile } from "./personalities";
import { staticExchange } from "./see";
import { Bound, scoreFromTT, scoreToTT, TranspositionTable } from "./transposition";
import { hashKey } from "./zobrist";
import { SearchBoard, type HardAction, type Undo } from "./SearchBoard";
import { HARD_BOT_CONFIG } from "./config";
import type { HardTerm } from "./weights";

export type { HardAction } from "./SearchBoard";

export type SearchBudget = { kind: "time"; ms: number } | { kind: "nodes"; n: number };

export interface HardSearchResult {
  /** Acciones del turno: 0..k bajadas de banca + 1 movimiento (o pass). */
  actions: HardAction[];
  score: number;
  depth: number;
  nodes: number;
  pv: HardAction[];
  ms: number;
  styleApplied: boolean;
}

const WIN = MEDIUM_BOT_CONFIG.winValue;
const MATE_THRESHOLD = WIN / 2;
const INF = 1_000_000;

class Aborted extends Error {}

interface Ctx {
  bot: Player;
  insight: RulesInsight;
  weights: Record<HardTerm, number>;
  posture: PostureSpec;
  sides: SideMultipliers;
  contempt: number;
  tt: TranspositionTable;
  /** Cache de evaluación por hash Zobrist (transposiciones reevalúan lo mismo). */
  evalCache: Map<string, number>;
  killers: Map<number, HardAction[]>;
  history: Map<string, number>;
  nodes: number;
  nodeBudget: number;
  deadline: number;
  timeMode: boolean;
  abortable: boolean;
  sb: SearchBoard;
  rng: Rng;
}

const actionKey = (a: HardAction): string =>
  a.kind === "move"
    ? `m:${a.pieceId}:${a.to.x},${a.to.y}`
    : a.kind === "bench"
      ? `b:${a.type}:${a.to.x},${a.to.y}`
      : "p";

const sameAction = (a: HardAction, b: HardAction): boolean => actionKey(a) === actionKey(b);

const histKey = (sb: SearchBoard, a: HardAction): string => {
  if (a.kind === "bench") return `b:${a.type}:${a.to.x},${a.to.y}`;
  if (a.kind === "pass") return "pass";
  const from = sb.board.getPieceById(a.pieceId)?.position;
  return `m:${from?.x ?? -1},${from?.y ?? -1}>${a.to.x},${a.to.y}`;
};

const isScoring = (sb: SearchBoard, a: HardAction): boolean =>
  a.kind === "move" && a.to.y === sb.rules.scoringRow(sb.current);

/** Evaluación en hoja desde la perspectiva del bando en turno (cacheada por hash). */
const leafValue = (ctx: Ctx): number => {
  const key = hashKey(ctx.sb.hash);
  const hit = ctx.evalCache.get(key);
  if (hit !== undefined) return hit;
  const v = evaluateHard(
    ctx.sb,
    ctx.bot,
    ctx.insight,
    ctx.weights,
    ctx.posture,
    ctx.sides,
    ctx.contempt,
  );
  const out = ctx.sb.current === ctx.bot ? v : -v;
  if (ctx.evalCache.size < 200_000) ctx.evalCache.set(key, out);
  return out;
};

const tick = (ctx: Ctx): void => {
  ctx.nodes += 1;
  if (!ctx.abortable) return;
  if (ctx.timeMode) {
    if (ctx.nodes % HARD_BOT_CONFIG.clockCheckEvery === 0 && performance.now() >= ctx.deadline) {
      throw new Aborted();
    }
  } else if (ctx.nodes > ctx.nodeBudget) {
    throw new Aborted();
  }
};

/** Acciones tácticas para quiescence: anotaciones, capturas SEE ≥ 0, avances a ≤ 1. */
const quiesceMoves = (ctx: Ctx): HardAction[] => {
  const sb = ctx.sb;
  const out: HardAction[] = [];
  const scoring = sb.rules.scoringRow(sb.current);
  const forward = sb.rules.forward(sb.current);
  for (const a of sb.generateMoves()) {
    if (a.kind !== "move") continue;
    if (a.to.y === scoring) {
      out.push(a);
      continue;
    }
    const target = sb.board.getPieceAt(new Position(a.to.x, a.to.y));
    if (target && target.owner !== sb.current) {
      if (
        staticExchange(
          sb.board,
          new Position(a.to.x, a.to.y),
          sb.current,
          sb.engine,
          ctx.insight,
        ) >= 0
      ) {
        out.push(a);
      }
      continue;
    }
    const piece = sb.board.getPieceById(a.pieceId);
    if (piece?.position && (a.to.y - piece.position.y) * forward > 0) {
      const d = Math.abs(scoring - a.to.y);
      if (d <= 1) out.push(a);
    }
  }
  return out;
};

const quiesce = (ctx: Ctx, α: number, β: number, q: number): number => {
  tick(ctx);
  const sb = ctx.sb;
  if (sb.winner) {
    return (sb.winner === sb.current ? 1 : -1) * (WIN - q);
  }
  const stand = leafValue(ctx);
  if (stand >= β) return stand;
  if (stand > α) α = stand;
  if (q >= HARD_BOT_CONFIG.qMaxPlies) return stand;
  for (const a of quiesceMoves(ctx)) {
    const u = sb.make(a);
    let score: number;
    try {
      score = -quiesce(ctx, -β, -α, q + 1);
    } finally {
      sb.unmake(u);
    }
    if (score >= β) return score;
    if (score > α) α = score;
  }
  return α;
};

/** Bajadas de banca de este turno ordenadas por heurística estática, top-K. */
const topBenchDrops = (ctx: Ctx): HardAction[] => {
  const drops = ctx.sb.generateBenchDrops();
  if (drops.length <= HARD_BOT_CONFIG.benchTopK) return drops;
  const A = analyzeBoard(ctx.sb.board, ctx.sb.engine, ctx.insight);
  const enemy = opponentOf(ctx.sb.current);
  const score = (a: HardAction): number => {
    if (a.kind !== "bench") return 0;
    const to = new Position(a.to.x, a.to.y);
    let s = ctx.insight.profiles.get(a.type)?.value ?? 0;
    if (A.isAttacked(to, ctx.sb.current)) s += 10; // casilla defendida
    if (A.isAttacked(to, enemy)) s -= 12; // casilla atacada por el rival
    return s;
  };
  return [...drops].sort((x, y) => score(y) - score(x)).slice(0, HARD_BOT_CONFIG.benchTopK);
};

interface Ordered {
  action: HardAction;
  captureValue: number;
  quiet: boolean;
}

const orderActions = (ctx: Ctx, ply: number, ttBest: HardAction | null): Ordered[] => {
  const sb = ctx.sb;
  const killers = ctx.killers.get(ply) ?? [];
  const drops = topBenchDrops(ctx);
  const moves = sb.generateMoves();
  const all: Ordered[] = [];
  for (const a of [...moves, ...drops]) {
    let captureValue = 0;
    if (a.kind === "move") {
      const target = sb.board.getPieceAt(new Position(a.to.x, a.to.y));
      if (target && target.owner !== sb.current) {
        captureValue = ctx.insight.profiles.get(target.type)?.value ?? 0;
      }
    }
    all.push({
      action: a,
      captureValue,
      quiet: a.kind === "move" && captureValue === 0 && !isScoring(sb, a),
    });
  }
  const rank = (o: Ordered): number => {
    const a = o.action;
    if (ttBest && sameAction(a, ttBest)) return 1e9;
    if (isScoring(sb, a)) return 1e8;
    if (o.captureValue > 0 && a.kind === "move") {
      const see = staticExchange(
        sb.board,
        new Position(a.to.x, a.to.y),
        sb.current,
        sb.engine,
        ctx.insight,
      );
      if (see >= 0) return 5e6 + o.captureValue * 100 + see;
    }
    const ki = killers.findIndex((k) => sameAction(k, a));
    if (ki >= 0) return 1e6 - ki;
    if (a.kind === "bench") return 5e5;
    return ctx.history.get(histKey(sb, a)) ?? 0;
  };
  return all.sort((x, y) => rank(y) - rank(x));
};

const rememberKiller = (ctx: Ctx, ply: number, a: HardAction): void => {
  const list = ctx.killers.get(ply) ?? [];
  if (list.some((k) => sameAction(k, a))) return;
  list.unshift(a);
  if (list.length > HARD_BOT_CONFIG.killersPerPly) list.pop();
  ctx.killers.set(ply, list);
};

const search = (
  ctx: Ctx,
  d: number,
  α: number,
  β: number,
  ply: number,
  benchUsed: number,
  canExtend: boolean,
): number => {
  tick(ctx);
  const sb = ctx.sb;
  if (sb.winner) {
    return (sb.winner === sb.current ? 1 : -1) * (WIN - ply);
  }
  if (d <= 0) return quiesce(ctx, α, β, 0);

  // Extensión única por rama: el rival tiene una pieza a ≤ 1 de anotar sin controlar.
  let ext = 0;
  if (canExtend && ply > 0) {
    const opp = opponentOf(sb.current);
    const threat = sb.board
      .getPiecesOf(opp)
      .some((p) => p.position && ctx.insight.distToGoal(p) <= 1);
    if (threat) {
      const A = analyzeBoard(sb.board, sb.engine, ctx.insight);
      const loose = sb.board
        .getPiecesOf(opp)
        .some(
          (p) =>
            p.position && ctx.insight.distToGoal(p) <= 1 && !A.isAdvanceControlled(p, sb.current),
        );
      if (loose) ext = 1;
    }
  }

  // Probe TT.
  const entry = ctx.tt.get(sb.hash);
  let ttBest: HardAction | null = null;
  if (entry) {
    ttBest = entry.best;
    if (entry.depth >= d) {
      const s = scoreFromTT(entry.score, ply, MATE_THRESHOLD);
      if (entry.bound === Bound.Exact) return s;
      if (entry.bound === Bound.Lower && s >= β) return s;
      if (entry.bound === Bound.Upper && s <= α) return s;
    }
  }

  const αOrig = α;
  const ordered = orderActions(ctx, ply, ttBest);
  const canBench = benchUsed < sb.rules.benchSize && sb.bench[sb.current].length > 0;
  const usable = canBench ? ordered : ordered.filter((o) => o.action.kind !== "bench");

  if (usable.length === 0) {
    // Sin acciones: pasa el turno.
    const u = sb.make({ kind: "pass" });
    try {
      return -search(ctx, d - 1 + ext, -β, -α, ply + 1, 0, canExtend);
    } finally {
      sb.unmake(u);
    }
  }

  let best = -INF;
  let bestAction: HardAction | null = null;
  let moveIndex = 0;

  for (const o of usable) {
    const a = o.action;
    const isBench = a.kind === "bench";
    if (isBench && !canBench) continue;
    const u: Undo = sb.make(a);
    let score: number;
    const nextD = d - 1 + ext;
    try {
      if (isBench) {
        // La bajada no consume turno ni profundidad: mismo bando, misma ventana.
        score =
          moveIndex === 0
            ? search(ctx, d, α, β, ply + 1, benchUsed + 1, canExtend)
            : search(ctx, d, α, α + 1, ply + 1, benchUsed + 1, canExtend);
        if (moveIndex > 0 && score > α && score < β) {
          score = search(ctx, d, α, β, ply + 1, benchUsed + 1, canExtend);
        }
      } else {
        // PVS: primera acción ventana completa; resto ventana nula + re-búsqueda.
        const reduce =
          o.quiet && moveIndex >= HARD_BOT_CONFIG.lmr.minIndex && d >= HARD_BOT_CONFIG.lmr.minDepth
            ? 1
            : 0;
        if (moveIndex === 0) {
          score = -search(ctx, nextD, -β, -α, ply + 1, 0, !ext && canExtend);
        } else {
          score = -search(ctx, nextD - reduce, -α - 1, -α, ply + 1, 0, !ext && canExtend);
          if (reduce > 0 && score > α) {
            score = -search(ctx, nextD, -α - 1, -α, ply + 1, 0, !ext && canExtend);
          }
          if (score > α && score < β) {
            score = -search(ctx, nextD, -β, -α, ply + 1, 0, !ext && canExtend);
          }
        }
      }
    } finally {
      sb.unmake(u);
    }
    moveIndex += 1;

    if (score > best) {
      best = score;
      bestAction = a;
    }
    if (score > α) α = score;
    if (α >= β) {
      if (o.quiet || a.kind === "bench") {
        rememberKiller(ctx, ply, a);
        ctx.history.set(histKey(sb, a), (ctx.history.get(histKey(sb, a)) ?? 0) + d * d);
      }
      break;
    }
  }

  const bound = best <= αOrig ? Bound.Upper : best >= β ? Bound.Lower : Bound.Exact;
  ctx.tt.set(sb.hash, {
    depth: d,
    score: scoreToTT(best, ply, MATE_THRESHOLD),
    bound,
    best: bestAction,
  });
  return best;
};

/** Reconstruye la PV caminando la TT desde la raíz (tope 24 acciones). */
const readPv = (ctx: Ctx): HardAction[] => {
  const pv: HardAction[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 24; i++) {
    const entry = ctx.tt.get(ctx.sb.hash);
    if (!entry?.best) break;
    const key = hashKey(ctx.sb.hash);
    if (seen.has(key)) break;
    seen.add(key);
    pv.push(entry.best);
    try {
      ctx.sb.make(entry.best);
    } catch {
      break; // acción no re-jugable en el clon (pieza de banca sin from)
    }
  }
  // No hace falta deshacer: se usa sobre un SearchBoard descartable o al final.
  return pv;
};

export function searchHard(
  root: SearchBoard,
  bot: Player,
  insight: RulesInsight,
  weights: Record<HardTerm, number>,
  profile: PersonalityProfile,
  budget: SearchBudget,
  rng: Rng,
  tt: TranspositionTable = new TranspositionTable(),
): HardSearchResult {
  const started = performance.now();
  const G = insight.geometry;
  // Postura fijada en la raíz: mantenerla por hoja hace la evaluación
  // inconsistente dentro de una línea (medido: empeora el nivel de juego).
  const posture = choosePosture(root.toSimState(), bot, root.engine, insight, undefined, {
    defendZone: G.runnerZone + profile.posture.defendZoneDelta,
    attackZone: G.runnerZone + 1 + profile.posture.attackZoneDelta,
    attackMaterialLeadRatio: profile.posture.attackMaterialLeadRatio,
  });

  const ctx: Ctx = {
    bot,
    insight,
    weights,
    posture,
    sides: { selfMul: profile.selfMul, oppMul: profile.oppMul },
    contempt: profile.contempt,
    tt,
    evalCache: new Map(),
    killers: new Map(),
    history: new Map(),
    nodes: 0,
    nodeBudget: budget.kind === "nodes" ? budget.n : Number.MAX_SAFE_INTEGER,
    deadline: budget.kind === "time" ? started + budget.ms : Infinity,
    timeMode: budget.kind === "time",
    abortable: false,
    sb: root,
    rng,
  };

  let ranked: { action: HardAction; score: number }[] = [];
  let completedDepth = 0;

  for (let d = 1; d <= HARD_BOT_CONFIG.maxDepth; d++) {
    ctx.abortable = d > 1;
    // Ventana de aspiración desde d ≥ 3.
    let α = -INF;
    let β = INF;
    const prev0 = ranked[0]?.score ?? -INF;
    const aspirated = d >= 3 && ranked.length > 0;
    const α0 = aspirated ? Math.max(-INF, prev0 - HARD_BOT_CONFIG.aspiration) : -INF;
    const β0 = aspirated ? Math.min(INF, prev0 + HARD_BOT_CONFIG.aspiration) : INF;
    if (aspirated) {
      α = α0;
      β = β0;
    }
    const iteration: { action: HardAction; score: number }[] = [];
    try {
      const ordered = orderActions(ctx, 0, null);
      // Re-ordenar con los puntajes de la iteración anterior.
      if (ranked.length > 0) {
        const prevScore = new Map(ranked.map((r) => [actionKey(r.action), r.score]));
        ordered.sort(
          (x, y) =>
            (prevScore.get(actionKey(y.action)) ?? -INF) -
            (prevScore.get(actionKey(x.action)) ?? -INF),
        );
      }
      const canBench = root.bench[root.current].length > 0;
      for (const o of ordered) {
        if (o.action.kind === "bench" && !canBench) continue;
        const u = root.make(o.action);
        let score: number;
        try {
          if (o.action.kind === "bench") {
            score =
              iteration.length === 0
                ? search(ctx, d, α, β, 1, 1, true)
                : search(ctx, d, α, α + 1, 1, 1, true);
            if (iteration.length > 0 && score > α && score < β) {
              score = search(ctx, d, α, β, 1, 1, true);
            }
          } else {
            score =
              iteration.length === 0
                ? -search(ctx, d - 1, -β, -α, 1, 0, true)
                : -search(ctx, d - 1, -α - 1, -α, 1, 0, true);
            if (iteration.length > 0 && score > α && score < β) {
              score = -search(ctx, d - 1, -β, -α, 1, 0, true);
            }
          }
        } finally {
          root.unmake(u);
        }
        iteration.push({ action: o.action, score });
        if (score > α) α = score;
      }
      // Aspiración fallida (score fuera de la ventana): repetir sin ventana.
      const bestIter = Math.max(...iteration.map((r) => r.score), -INF);
      if (aspirated && (bestIter <= α0 || bestIter >= β0)) {
        iteration.length = 0;
        for (const o of ordered) {
          if (o.action.kind === "bench" && !canBench) continue;
          const u = root.make(o.action);
          try {
            const score =
              o.action.kind === "bench"
                ? search(ctx, d, -INF, INF, 1, 1, true)
                : -search(ctx, d - 1, -INF, INF, 1, 0, true);
            iteration.push({ action: o.action, score });
          } finally {
            root.unmake(u);
          }
        }
      }
      ranked = iteration.sort((a, b) => b.score - a.score);
      completedDepth = d;
    } catch (err) {
      if (!(err instanceof Aborted)) throw err;
      break;
    }
    if (ranked[0] && ranked[0].score >= MATE_THRESHOLD) break; // victoria forzada
  }

  const result: HardSearchResult = {
    actions: [],
    score: ranked[0]?.score ?? 0,
    depth: completedDepth,
    nodes: ctx.nodes,
    pv: [],
    ms: performance.now() - started,
    styleApplied: false,
  };

  if (ranked.length === 0) {
    result.actions = [{ kind: "pass" }];
    return result;
  }

  // Desempate por estilo: candidatas a ≤ tieWindow de la mejor. Las jugadas no
  // primeras se evaluaron con ventana nula → su score es una cota superior; un
  // "empate" puede ser falso. Re-verificar con ventana abierta antes de elegir.
  let best = ranked[0]!;
  const tied = ranked.filter((r) => r.score >= best.score - profile.tieWindow);
  if (tied.length > 1) {
    // Re-verificar dentro del presupuesto: si se agota, la candidata queda
    // con su cota de la iteración (degradación acotada, no overshoot).
    const exact: { r: (typeof ranked)[number]; score: number }[] = [];
    for (const r of tied) {
      const u = root.make(r.action);
      try {
        const s =
          r.action.kind === "bench"
            ? search(ctx, completedDepth, -INF, INF, 1, 1, true)
            : -search(ctx, completedDepth - 1, -INF, INF, 1, 0, true);
        exact.push({ r, score: s });
      } catch (err) {
        if (!(err instanceof Aborted)) throw err;
        exact.push({ r, score: r.score });
        break;
      } finally {
        root.unmake(u);
      }
    }
    const exactBest = Math.max(...exact.map((e) => e.score));
    const real = exact.filter((e) => e.score >= exactBest - profile.tieWindow);
    if (real.length > 1 && exactBest < MATE_THRESHOLD && profile.tieBreak !== "none") {
      const scored = real.map((e) => ({ e, style: styleScore(root, e.r.action, ctx, profile) }));
      const maxStyle = Math.max(...scored.map((s) => s.style));
      const top = scored.filter((s) => s.style === maxStyle).map((s) => s.e.r);
      best = top[Math.floor(rng() * top.length)]!;
      result.styleApplied = true;
      result.score = exactBest;
    } else {
      best = real[Math.floor(rng() * real.length)]!.r;
      result.score = exactBest;
    }
  }

  // La raíz no pasa por `search()`: guardar su entrada para reconstruir la PV.
  ctx.tt.set(root.hash, {
    depth: completedDepth,
    score: scoreToTT(best.score, 0, MATE_THRESHOLD),
    bound: Bound.Exact,
    best: best.action,
  });

  // PV desde la TT (sobre un clon para no tocar root).
  const pvBoard = new SearchBoard(root.toSimState(), root.engine);
  ctx.sb = pvBoard;
  const pv = readPv(ctx);
  ctx.sb = root;
  result.pv = pv;

  // Acciones del turno: prefijo de la PV hasta el primer movimiento incluido.
  const actions: HardAction[] = [];
  const pv0 = pv.length > 0 && sameAction(pv[0]!, best.action) ? pv : [best.action];
  for (const a of pv0) {
    actions.push(a);
    if (a.kind !== "bench") break;
  }
  if (actions.length === 0) actions.push(best.action);
  result.actions = actions;
  return result;
}

/**
 * Puntaje de estilo para el desempate raíz según `tieBreak`:
 * "progress" → mayor progreso propio tras la acción;
 * "safety" → menos piezas propias atacadas tras la acción.
 */
const styleScore = (
  root: SearchBoard,
  action: HardAction,
  ctx: Ctx,
  profile: PersonalityProfile,
): number => {
  const u = root.make(action);
  try {
    const mover = u.prevCurrent;
    const enemy = opponentOf(mover);
    const A = analyzeBoard(root.board, root.engine, ctx.insight);
    let progress = 0;
    let attacked = 0;
    for (const p of root.board.getPiecesOf(mover)) {
      if (!p.position) continue;
      progress += ctx.insight.progress(p);
      if (A.isAttacked(p.position, enemy)) attacked += 1;
    }
    return profile.tieBreak === "progress" ? progress : -attacked;
  } finally {
    root.unmake(u);
  }
};
