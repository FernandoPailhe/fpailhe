import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../../domain/constants/GameRules";
import { rulesFingerprint, type RulesView } from "../../../domain/config/RulesView";
import { countsOf, feasibleTypes, type TypeCounts } from "../../../domain/rules/composition";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import { chooseBenchType, chooseSetupPlacement, targetComposition } from "../medium/setupStrategy";
import { opponentOf, type SimState } from "../sim/SimState";
import type { BotContext } from "../ComputerPlayer";
import type { RulesInsight } from "../introspection/profiles";
import { createSeededRng, type Rng } from "../rng";
import type { PersonalityProfile } from "./personalities";
import { SearchBoard } from "./SearchBoard";
import { searchHard } from "./search";
import { loadHardWeights } from "./weights";
import { TranspositionTable } from "./transposition";

/** Ejército completo planeado: piezas con casilla + tipos de banca. */
export interface ArmyPlan {
  boardPieces: { type: PieceType; position: Position }[];
  benchPieces: PieceType[];
}

export interface SetupBudget {
  candidates: number;
  nodesPerEval: number;
}

export const DEFAULT_SETUP_BUDGET: SetupBudget = { candidates: 24, nodesPerEval: 3_000 };

const sumCounts = (c: TypeCounts): number => Object.values(c).reduce((a, b) => a + b, 0);

const pickIndex = <T>(arr: readonly T[], rng: Rng): T | undefined =>
  arr[Math.floor(rng() * arr.length)];

/** Tipos ya elegidos por el bot (seleccionadas + banca) y slots restantes. */
const chosenTypes = (ctx: BotContext): { counts: TypeCounts; remaining: number } => {
  const chosen = ctx.botState
    .getSelectedPieces()
    .concat(ctx.botState.getBenchPieces().map((p) => p.type));
  return {
    counts: countsOf(chosen, ctx.rules),
    remaining: ctx.rules.piecesToPlace + ctx.rules.benchSize - chosen.length,
  };
};

/**
 * Piezas ya fijadas: colocadas en el tablero (`fixed`) y tipos seleccionados
 * que aún no tienen casilla (`pending`, caso raro de pick sin colocar).
 */
const fixedAndPending = (
  ctx: BotContext,
): { fixed: { type: PieceType; position: Position }[]; pending: PieceType[] } => {
  const placed = ctx.board
    .getAllPieces()
    .filter((p) => p.owner === ctx.bot && p.position)
    .map((p) => ({ type: p.type, position: p.position! }));
  const used = new Map<PieceType, number>();
  for (const f of placed) used.set(f.type, (used.get(f.type) ?? 0) + 1);
  const pending: PieceType[] = [];
  for (const t of ctx.botState.getSelectedPieces()) {
    const left = used.get(t) ?? 0;
    if (left > 0) used.set(t, left - 1);
    else pending.push(t);
  }
  return { fixed: placed, pending };
};

/**
 * Composición objetivo sesgada por `roleTilt` de la personalidad: cada tipo
 * suma el tilt de sus roles; el total se conserva moviendo unidades de los
 * tipos con menor tilt a los de mayor tilt, dentro de [min, max] por tipo.
 */
export function tiltedComposition(insight: RulesInsight, profile: PersonalityProfile): TypeCounts {
  const { rules } = insight;
  const target = targetComposition(insight);
  const tiltOf = (t: PieceType): number => {
    let s = 0;
    insight.profiles.get(t)?.roles.forEach((r) => {
      s += profile.setup.roleTilt[r] ?? 0;
    });
    return s;
  };
  const desired = { ...target };
  for (const t of rules.pieceTypes) {
    desired[t] = Math.min(
      rules.maxPerType,
      Math.max(rules.minPerType, target[t] + Math.round(tiltOf(t))),
    );
  }
  const total = rules.piecesToPlace + rules.benchSize;
  const byTiltAsc = [...rules.pieceTypes].sort((a, b) => tiltOf(a) - tiltOf(b));
  let guard = total * 8;
  while (sumCounts(desired) > total && guard-- > 0) {
    const donor = byTiltAsc.find((t) => desired[t] > rules.minPerType);
    if (!donor) break;
    desired[donor] -= 1;
  }
  guard = total * 8;
  while (sumCounts(desired) < total && guard-- > 0) {
    const receiver = [...byTiltAsc].reverse().find((t) => desired[t] < rules.maxPerType);
    if (!receiver) break;
    desired[receiver] += 1;
  }
  return desired;
}

interface FillSpec {
  /** Piezas ya en el tablero (intocables). */
  fixed: { type: PieceType; position: Position }[];
  /** Tipos elegidos sin casilla todavía (deben entrar primero). */
  pendingBoard: PieceType[];
  /** Tipos de banca ya elegidos. */
  benchChosen: PieceType[];
  /** Casillas ocupadas por cualquier pieza (ambos bandos). */
  occupied: readonly Position[];
}

/** Casillas de despliegue libres respetando maxPerRow y casillas ocupadas. */
const freeSquaresOf = (
  rules: RulesView,
  player: Player,
  placed: readonly { position: Position }[],
  occupied: readonly Position[],
): Position[] => {
  const taken = new Set(occupied.map((p) => `${p.x},${p.y}`));
  const rowUse = new Map<number, number>();
  for (const f of placed) {
    taken.add(`${f.position.x},${f.position.y}`);
    rowUse.set(f.position.y, (rowUse.get(f.position.y) ?? 0) + 1);
  }
  const out: Position[] = [];
  for (const row of rules.placementRows(player)) {
    if ((rowUse.get(row) ?? 0) >= rules.maxPerRow) continue;
    for (let x = 0; x < rules.width; x++) {
      if (!taken.has(`${x},${row}`)) out.push(new Position(x, row));
    }
  }
  return out;
};

/**
 * Completa un ejército al azar respetando `fixed`/`pending`/`benchChosen`:
 * el resto se llena con tipos factibles y casillas libres (misma semántica
 * que `generateRandomArmy` pero partiendo de un ejército parcial).
 */
function completeRandomArmy(
  rules: RulesView,
  player: Player,
  spec: FillSpec,
  rng: Rng,
): ArmyPlan | null {
  const totalSlots = rules.piecesToPlace + rules.benchSize;
  const boardPieces = [...spec.fixed];
  const benchPieces = [...spec.benchChosen];
  const counts = countsOf(
    [...spec.fixed.map((f) => f.type), ...spec.pendingBoard, ...spec.benchChosen],
    rules,
  );
  const remaining = (): number => totalSlots - sumCounts(counts);

  const placeRandom = (type: PieceType): boolean => {
    const position = pickIndex(freeSquaresOf(rules, player, boardPieces, spec.occupied), rng);
    if (!position) return false;
    boardPieces.push({ type, position });
    return true;
  };

  for (const t of spec.pendingBoard) {
    if (!placeRandom(t)) return null;
  }
  const pickFeasible = (): PieceType | undefined => {
    const type = pickIndex(feasibleTypes(counts, remaining(), rules), rng);
    if (type !== undefined) counts[type] += 1;
    return type;
  };
  while (boardPieces.length < rules.piecesToPlace) {
    const type = pickFeasible();
    if (type === undefined || !placeRandom(type)) return null;
  }
  while (benchPieces.length < rules.benchSize) {
    const type = pickFeasible();
    if (type === undefined) return null;
    benchPieces.push(type);
  }
  return { boardPieces, benchPieces };
}

/**
 * Completa el ejército con el greedy de Medium (una pieza a la vez) sobre un
 * contexto simulado. La composición objetivo ya trae el sesgo `roleTilt`.
 */
function completeGreedyArmy(
  ctx: BotContext,
  insight: RulesInsight,
  profile: PersonalityProfile,
  spec: FillSpec,
  rng: Rng,
): ArmyPlan | null {
  const { rules, bot } = ctx;
  const target = tiltedComposition(insight, profile);
  const board = new Board(rules.width, rules.height);
  let id = 0;
  for (const p of ctx.board.getAllPieces()) {
    if (p.position) board.addPiece(p.clone());
  }
  const ps = new PlayerState("plan");
  ctx.botState.getSelectedPieces().forEach((t) => ps.addSelectedPiece(t));
  ctx.botState.getBenchPieces().forEach((p) => ps.addBenchPiece(p.clone()));
  const simCtx: BotContext = { ...ctx, board, botState: ps, rng };

  const boardPieces = [...spec.fixed];
  for (const t of spec.pendingBoard) {
    const position = freeSquaresOf(rules, bot, boardPieces, spec.occupied)[0];
    if (!position) return null;
    board.addPiece(new GamePiece(`plan-${id++}`, t, position, bot));
    boardPieces.push({ type: t, position });
  }
  while (boardPieces.length < rules.piecesToPlace) {
    const next = chooseSetupPlacement(simCtx, insight, target);
    if (!next) return null;
    board.addPiece(new GamePiece(`plan-${id++}`, next.type, next.position, bot));
    ps.addSelectedPiece(next.type);
    boardPieces.push(next);
  }
  const benchPieces = [...spec.benchChosen];
  while (benchPieces.length < rules.benchSize) {
    const t = chooseBenchType(simCtx, insight, target);
    if (t === null) return null;
    ps.addBenchPiece(new GamePiece(`plan-bench-${id++}`, t, null, bot));
    benchPieces.push(t);
  }
  return { boardPieces, benchPieces };
}

/** Filas "delanteras": la mitad de las filas de despliegue más lejana a home. */
const frontRowsOf = (rules: RulesView, player: Player): Set<number> => {
  const home = rules.homeRow(player);
  const byDepth = [...rules.placementRows(player)].sort(
    (a, b) => Math.abs(a - home) - Math.abs(b - home),
  );
  return new Set(byDepth.slice(Math.floor(byDepth.length / 2)));
};

const frontCountOf = (rules: RulesView, player: Player, plan: ArmyPlan): number => {
  const front = frontRowsOf(rules, player);
  return plan.boardPieces.filter((p) => front.has(p.position.y)).length;
};

/**
 * Puntaje de un candidato: promedio del score de `searchHard` (perspectiva
 * del bot) sobre los ejércitos rivales de prueba, más `frontBias` por pieza
 * en la mitad delantera del despliegue.
 */
function scorePlan(
  plan: ArmyPlan,
  enemies: ArmyPlan[],
  ctx: BotContext,
  insight: RulesInsight,
  profile: PersonalityProfile,
  nodesPerEval: number,
  rng: Rng,
): number {
  const { rules, engine, bot } = ctx;
  const enemy = opponentOf(bot);
  const { weights } = loadHardWeights(rulesFingerprint(rules, engine.config));
  const tt = new TranspositionTable();

  let total = 0;
  for (const foe of enemies) {
    const board = new Board(rules.width, rules.height);
    let id = 0;
    for (const { type, position } of plan.boardPieces) {
      board.addPiece(new GamePiece(`c-${id++}`, type, position, bot));
    }
    for (const { type, position } of foe.boardPieces) {
      board.addPiece(new GamePiece(`e-${id++}`, type, position, enemy));
    }
    const bench = {} as SimState["bench"];
    bench[bot] = plan.benchPieces;
    bench[enemy] = foe.benchPieces;
    const sim: SimState = {
      rules,
      board,
      current: Player.BLANCAS, // PLAYING siempre arranca BLANCAS
      scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
      bench,
      winner: null,
    };
    const res = searchHard(
      new SearchBoard(sim, engine),
      bot,
      insight,
      weights,
      profile,
      { kind: "nodes", n: nodesPerEval },
      createSeededRng(Math.floor(rng() * 0x7fffffff)),
      tt,
    );
    total += sim.current === bot ? res.score : -res.score;
  }
  return (
    total / Math.max(1, enemies.length) + profile.setup.frontBias * frontCountOf(rules, bot, plan)
  );
}

/** Ejércitos de prueba del rival según lo que el bot puede ver. */
function enemyArmies(
  ctx: BotContext,
  insight: RulesInsight,
  profile: PersonalityProfile,
  rng: Rng,
): ArmyPlan[] {
  const { rules, board } = ctx;
  const enemy = opponentOf(ctx.bot);
  const occupied = board.getAllPieces().flatMap((p) => (p.position ? [p.position] : []));
  const enemySpec = (): FillSpec => ({
    fixed: board
      .getAllPieces()
      .filter((p) => p.owner === enemy && p.position)
      .map((p) => ({ type: p.type, position: p.position! })),
    pendingBoard: [],
    benchChosen: ctx.opponentState.getBenchPieces().map((p) => p.type),
    occupied,
  });

  const foes: ArmyPlan[] = [];
  for (let i = 0; i < 3; i++) {
    const a = completeRandomArmy(rules, enemy, enemySpec(), rng);
    if (a) foes.push(a);
  }
  if (ctx.setupMode === SetupTurnMode.HIDDEN) {
    // Un rival greedy representativo, evaluado desde su propia perspectiva.
    const enemyCtx: BotContext = {
      ...ctx,
      bot: enemy,
      botState: ctx.opponentState,
      opponentState: ctx.botState,
    };
    const greedy = completeGreedyArmy(enemyCtx, insight, profile, enemySpec(), rng);
    if (greedy) foes.push(greedy);
  }
  return foes;
}

/**
 * Planifica el ejército del bot comparando candidatos (mitad greedy con
 * ruido, mitad aleatorios) evaluados con búsqueda corta contra ejércitos
 * rivales de prueba. Determinista para un `rng` sembrado. Pensado para
 * correr en el worker (ver `prepareSetupAsync`).
 */
export function planHardArmy(
  ctx: BotContext,
  insight: RulesInsight,
  profile: PersonalityProfile,
  rng: Rng,
  budget: SetupBudget = DEFAULT_SETUP_BUDGET,
): ArmyPlan {
  const { rules, board, bot } = ctx;
  const { fixed, pending } = fixedAndPending(ctx);
  const spec: FillSpec = {
    fixed,
    pendingBoard: pending,
    benchChosen: ctx.botState.getBenchPieces().map((p) => p.type),
    occupied: board.getAllPieces().flatMap((p) => (p.position ? [p.position] : [])),
  };

  const candidates: ArmyPlan[] = [];
  const greedyCount = Math.ceil(budget.candidates / 2);
  for (let i = 0; i < greedyCount; i++) {
    const a = completeGreedyArmy(ctx, insight, profile, spec, rng);
    if (a) candidates.push(a);
  }
  while (candidates.length < budget.candidates) {
    const a = completeRandomArmy(rules, bot, spec, rng);
    if (!a) break;
    candidates.push(a);
  }

  // Sin candidatos (reglas imposibles): devolver lo ya fijado.
  if (candidates.length === 0) {
    return { boardPieces: fixed, benchPieces: spec.benchChosen };
  }

  const foes = enemyArmies(ctx, insight, profile, rng);
  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const s =
      foes.length === 0
        ? profile.setup.frontBias * frontCountOf(rules, bot, c)
        : scorePlan(c, foes, ctx, insight, profile, budget.nodesPerEval, rng);
    if (s + rng() * 1e-6 > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

/**
 * Próxima pieza del plan que aún no está en el tablero y sigue siendo legal
 * (casilla libre de despliegue y tipo factible con lo ya elegido).
 */
export function nextFromPlan(
  ctx: BotContext,
  plan: ArmyPlan,
): { type: PieceType; position: Position } | null {
  const free = new Set(
    getBenchPlacementSquares(ctx.board, ctx.bot, ctx.rules).map((p) => `${p.x},${p.y}`),
  );
  const { counts, remaining } = chosenTypes(ctx);
  const types = feasibleTypes(counts, remaining, ctx.rules);
  for (const { type, position } of plan.boardPieces) {
    if (!free.has(`${position.x},${position.y}`)) continue;
    if (ctx.board.getPieceAt(position)) continue;
    if (types.includes(type)) return { type, position };
  }
  return null;
}

/** Próximo tipo de banca del plan que falta elegir y sigue siendo factible. */
export function nextBenchFromPlan(ctx: BotContext, plan: ArmyPlan): PieceType | null {
  const planned = countsOf(plan.benchPieces, ctx.rules);
  const chosen = countsOf(
    ctx.botState.getBenchPieces().map((p) => p.type),
    ctx.rules,
  );
  const { counts: all, remaining } = chosenTypes(ctx);
  const types = feasibleTypes(all, remaining, ctx.rules);
  for (const type of ctx.rules.pieceTypes) {
    if (chosen[type] < planned[type] && types.includes(type)) return type;
  }
  return null;
}
