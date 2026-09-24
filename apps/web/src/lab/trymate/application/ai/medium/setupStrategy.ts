import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import type { PieceType } from "../../../domain/constants/PieceConstants";
import {
  countsOf,
  emptyCounts,
  feasibleTypes,
  type TypeCounts,
} from "../../../domain/rules/composition";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import { analyzeBoard } from "../analysis/boardAnalysis";
import type { RulesInsight } from "../introspection/profiles";
import type { BotContext } from "../ComputerPlayer";
import { cloneBoard, opponentOf } from "../sim/SimState";
import { MEDIUM_BOT_CONFIG } from "./config";

const cfg = MEDIUM_BOT_CONFIG.setup;

/**
 * Composición objetivo del ejército (`piecesToPlace + benchSize` piezas):
 * mínimos por tipo primero; el resto se reparte proporcional al valor del
 * perfil por mayor resto, sin superar `maxPerType`. Deriva de los perfiles
 * sondeados — si cambian tipos o cantidades, se recalcula sola.
 */
export function targetComposition(insight: RulesInsight): TypeCounts {
  const { rules } = insight;
  const counts = emptyCounts(rules);
  let assigned = 0;
  for (const type of rules.pieceTypes) {
    counts[type] = rules.minPerType;
    assigned += rules.minPerType;
  }
  const total = rules.piecesToPlace + rules.benchSize;
  const extra = Math.max(0, total - assigned);
  if (extra === 0) return counts;

  const value = (t: PieceType) => insight.profiles.get(t)?.value ?? 0;
  const valueSum = rules.pieceTypes.reduce((s, t) => s + value(t), 0);
  const quotas = rules.pieceTypes.map((type) => {
    const ideal = valueSum > 0 ? (extra * value(type)) / valueSum : extra / rules.pieceTypes.length;
    return { type, floor: Math.floor(ideal), rem: ideal - Math.floor(ideal) };
  });
  for (const q of quotas) {
    counts[q.type] = Math.min(rules.maxPerType, counts[q.type] + q.floor);
    assigned += counts[q.type] - rules.minPerType;
  }
  quotas.sort((a, b) => b.rem - a.rem);
  let i = 0;
  while (assigned < total && quotas.length > 0) {
    const q = quotas[i % quotas.length]!;
    if (counts[q.type] < rules.maxPerType) {
      counts[q.type] += 1;
      assigned += 1;
    }
    i += 1;
    if (i > total * 4) break; // todos en máximo: no se puede repartir más
  }
  return counts;
}

/** Tipos ya elegidos por el bot (tablero + banca) y slots que le quedan. */
function chosenTypes(ctx: BotContext): { counts: TypeCounts; remaining: number } {
  const chosen = ctx.botState
    .getSelectedPieces()
    .concat(ctx.botState.getBenchPieces().map((p) => p.type));
  return {
    counts: countsOf(chosen, ctx.rules),
    remaining: ctx.rules.piecesToPlace + ctx.rules.benchSize - chosen.length,
  };
}

/**
 * Elige la próxima pieza de despliegue: prueba cada tipo factible en cada
 * casilla válida y puntúa el tablero resultante con reglas de rol —
 * bloqueadores adelante cubriendo la fila frontal, corredores en el carril
 * más abierto, piezas defendidas, contra-picks por `matchup` contra rivales
 * visibles. En HIDDEN el tablero ya viene filtrado y los términos de rival
 * valen 0 solos. Devuelve `null` si no hay combinación legal.
 */
export function chooseSetupPlacement(
  ctx: BotContext,
  insight: RulesInsight,
  target: TypeCounts = targetComposition(insight),
): { type: PieceType; position: Position } | null {
  const { board, bot, engine, rules, rng } = ctx;
  const { counts, remaining } = chosenTypes(ctx);
  const types = feasibleTypes(counts, remaining, rules);
  const squares = getBenchPlacementSquares(board, bot, rules);
  if (types.length === 0 || squares.length === 0) return null;

  const enemy = opponentOf(bot);
  const enemies = board.getAllPieces().filter((p) => p.owner === enemy && p.position);
  const G = insight.geometry;
  const home = rules.homeRow(bot);
  const rows = rules.placementRows(bot);
  // depthIdx: 0 = más atrás (más cerca de home), D − 1 = frontal.
  const byDepth = [...rows].sort((a, b) => Math.abs(a - home) - Math.abs(b - home));
  const depthFrac = (y: number): number =>
    rows.length <= 1 ? 1 : byDepth.indexOf(y) / (rows.length - 1);
  // Fila inmediatamente delante de la zona propia (la que cubren los bloqueadores).
  const frontRow = byDepth[rows.length - 1]! + rules.forward(bot);
  const coversFront = frontRow >= 0 && frontRow < rules.height;
  const centerX = (rules.width - 1) / 2;

  const covered = (A: ReturnType<typeof analyzeBoard>, b: typeof board, x: number): boolean => {
    const square = new Position(x, frontRow);
    const occupant = b.getPieceAt(square);
    return (occupant !== undefined && occupant.owner === bot) || A.isAttacked(square, bot);
  };
  const before = coversFront ? analyzeBoard(board, engine, insight) : null;
  const coveredBefore = new Set<number>();
  if (before) {
    for (let x = 0; x < rules.width; x++) {
      if (covered(before, board, x)) coveredBefore.add(x);
    }
  }

  interface Candidate {
    type: PieceType;
    position: Position;
    score: number;
  }
  const candidates: Candidate[] = [];

  for (const type of types) {
    const roles = insight.profiles.get(type)?.roles;
    for (const position of squares) {
      const clone = cloneBoard(board);
      const piece = new GamePiece("setup-cand", type, position, bot);
      clone.addPiece(piece);
      const A = analyzeBoard(clone, engine, insight);

      let score = counts[type] < target[type] ? cfg.belowTarget : -cfg.belowTarget;

      if (roles?.has("blocker")) score += cfg.blockerDepth * depthFrac(position.y);
      if (roles?.has("runner")) {
        const laneEnemies = enemies.filter(
          (e) => Math.abs(e.position!.x - position.x) <= G.laneWindow,
        ).length;
        const openness = 1 - laneEnemies / Math.max(1, rules.width);
        // A igual apertura gana el centro: descuento por distancia al centro.
        score +=
          cfg.runnerOpenColumn * (openness - (Math.abs(position.x - centerX) / rules.width) * 0.5);
        if (!roles.has("attacker")) {
          score += cfg.runnerBack * (1 - depthFrac(position.y));
        }
      }

      if (A.isDefended(piece)) score += cfg.defended;
      const defendsOther = engine
        .getCaptureSquares(piece, clone)
        .some((sq) => clone.getPieceAt(sq)?.owner === bot);
      if (defendsOther) score += cfg.defendsOther;

      if (coversFront) {
        let newlyCovered = 0;
        for (let x = 0; x < rules.width; x++) {
          if (!coveredBefore.has(x) && covered(A, clone, x)) newlyCovered += 1;
        }
        score += cfg.coveragePerColumn * newlyCovered;
      }

      // Contra-pick contra rivales visibles cercanos en columna.
      let counter = 0;
      for (const e of enemies) {
        if (Math.abs(e.position!.x - position.x) <= G.laneWindow + 1) {
          counter += insight.matchup(type, e.type);
        }
      }
      score += cfg.counterPick * counter;

      if (A.isAttacked(position, enemy) && !A.isDefended(piece)) score += cfg.exposed;

      score += rng() * cfg.noise;
      candidates.push({ type, position, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best ? { type: best.type, position: best.position } : null;
}

/**
 * Tipo de banca: solo candidatos factibles (garantiza mínimos). Puntaje =
 * Σ `matchup(tipo, rival)` sobre rivales visibles + 0.5 si el tipo está por
 * debajo de su objetivo. Empate → mayor valor de perfil.
 */
export function chooseBenchType(
  ctx: BotContext,
  insight: RulesInsight,
  target: TypeCounts = targetComposition(insight),
): PieceType | null {
  const { counts, remaining } = chosenTypes(ctx);
  const candidates = feasibleTypes(counts, remaining, ctx.rules);
  if (candidates.length === 0) return null;

  const enemy = opponentOf(ctx.bot);
  const enemies = ctx.board.getAllPieces().filter((p) => p.owner === enemy && p.position);

  let best: PieceType | null = null;
  let bestScore = -Infinity;
  let bestValue = -Infinity;
  for (const type of candidates) {
    let score = enemies.reduce((s, e) => s + insight.matchup(type, e.type), 0);
    if (counts[type] < target[type]) score += 0.5;
    const value = insight.profiles.get(type)?.value ?? 0;
    if (score > bestScore || (score === bestScore && value > bestValue)) {
      best = type;
      bestScore = score;
      bestValue = value;
    }
  }
  return best;
}
