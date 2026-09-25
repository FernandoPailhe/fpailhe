import { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import { analyzeBoard, type BoardAnalysis } from "../analysis/boardAnalysis";
import type { RulesInsight } from "../introspection/profiles";
import { MEDIUM_BOT_CONFIG } from "../medium/config";
import { opponentOf } from "../sim/SimState";
import { hashKey, xorHash } from "./zobrist";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import { SearchBoard } from "./SearchBoard";

export interface RaceInfo {
  unstoppable: boolean;
  turnsToScore: number;
  turnsToCatch: number;
}

const MAX_BFS_NODES = 4_000;
const raceCache = new Map<string, RaceInfo>();
const MAX_CACHE = 20_000;

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Carrera de un corredor: ¿anota antes de que el rival pueda capturarlo o
 * taparle el camino? El corredor queda quieto; el rival mueve pieza a pieza
 * (BFS acotado a `turnsToScore + 1` movimientos). Solo se llama para piezas
 * cerca de la meta con carril libre.
 */
export function analyzeRunner(
  sb: SearchBoard,
  pieceId: string,
  insight: RulesInsight,
  analysis?: BoardAnalysis,
): RaceInfo {
  const none: RaceInfo = { unstoppable: false, turnsToScore: Infinity, turnsToCatch: Infinity };
  const piece = sb.board.getPieceById(pieceId);
  if (!piece?.position) return none;

  const cacheKey = `${hashKey(sb.hash)}|${pieceId}`;
  const cached = raceCache.get(cacheKey);
  if (cached) return cached;

  const profile = insight.profiles.get(piece.type);
  const dist = insight.distToGoal(piece);
  const A = analysis ?? analyzeBoard(sb.board, sb.engine, insight);
  const result = (info: RaceInfo): RaceInfo => {
    if (raceCache.size >= MAX_CACHE) raceCache.clear();
    raceCache.set(cacheKey, info);
    return info;
  };

  if (!profile || !profile.roles.has("runner")) return result(none);
  if (dist > insight.geometry.runnerZone + 2 || !A.hasFreeLane(piece)) return result(none);

  let turnsToScore = Math.ceil(dist / Math.max(1, profile.forwardReach));
  // El camino inmediato está ocupado: pierde una jugada librándose.
  if (A.advanceMoves(piece).length === 0) turnsToScore += 1;

  // Camino optimista: la columna del corredor hasta la fila de anotación.
  const forward = sb.rules.forward(piece.owner);
  const path: Position[] = [piece.position];
  for (
    let y = piece.position.y + forward;
    y !== sb.rules.scoringRow(piece.owner) + forward;
    y += forward
  ) {
    if (y < 0 || y >= sb.rules.height) break;
    path.push(new Position(piece.position.x, y));
  }
  const catcher = opponentOf(piece.owner);
  const reach =
    insight.geometry.supportRadius +
    Math.max(1, ...[...insight.profiles.values()].map((p) => p.forwardReach));

  const isCaught = (b: SearchBoard): boolean => {
    for (const p of b.board.getPiecesOf(catcher)) {
      if (!p.position) continue;
      // Ocupa una casilla del camino (bloquea el paso del corredor).
      for (const sq of path) {
        if (p.position.equals(sq)) return true;
      }
      for (const sq of b.engine.getCaptureSquares(p, b.board)) {
        for (const target of path) {
          if (sq.equals(target)) return true;
        }
      }
    }
    return false;
  };

  // BFS por turnos del rival sobre un SearchBoard aparte (move + pass para
  // que vuelva a jugar el mismo bando). Poda: solo movimientos que acercan a
  // `reach` del camino o que ya están dentro.
  const scratch = new SearchBoard(sb.toSimState(), sb.engine);
  if (scratch.current !== catcher) {
    scratch.hash = xorHash(scratch.hash, scratch.keys.side);
    scratch.current = catcher;
  }
  const tempo = sb.current === piece.owner ? 1 : 0;

  // Recurso que la BFS de movimientos no ve: el rival puede bajar una pieza
  // de banca al camino (acción libre, y sus filas de despliegue son la zona
  // hacia donde corre el corredor). Si el tapón deja al corredor sin avances
  // válidos lo frena en 1; si solo lo obliga a gastar una jugada, +1 tempo.
  const placeRows = new Set(sb.rules.placementRows(catcher));
  if (
    sb.bench[catcher].length > 0 &&
    sb.piecesOnBoard[catcher] < sb.rules.piecesToPlace &&
    path.some((p) => placeRows.has(p.y))
  ) {
    const dropType = sb.bench[catcher][0]!;
    const runnerPiece = scratch.board.getPieceById(pieceId);
    const goal = sb.rules.scoringRow(piece.owner);
    let delay = 0;
    for (const sq of getBenchPlacementSquares(scratch.board, catcher, sb.rules)) {
      if (!runnerPiece?.position || !path.some((p) => p.equals(sq))) continue;
      const u = scratch.make({ kind: "bench", type: dropType, to: { x: sq.x, y: sq.y } });
      const advances = scratch.engine
        .getValidMoves(runnerPiece, scratch.board)
        .filter((m) => Math.abs(goal - m.y) < Math.abs(goal - runnerPiece.position!.y));
      scratch.unmake(u);
      if (advances.length === 0) {
        return result({
          unstoppable: turnsToScore < 1 + tempo,
          turnsToScore,
          turnsToCatch: 1,
        });
      }
      // Si puede comerse el tapón avanzando, el drop no cuesta tempo alguno.
      if (!advances.some((m) => m.x === sq.x && m.y === sq.y)) delay = 1;
    }
    turnsToScore += delay;
  }

  const bound = turnsToScore + 1;
  let nodes = 0;
  let caughtAt = Infinity;
  let budgetOut = false;

  const nearPath = (to: { x: number; y: number }): boolean =>
    path.some((sq) => chebyshev(sq, to) <= reach);

  const dfs = (depth: number): void => {
    if (caughtAt <= depth || budgetOut) return;
    if (isCaught(scratch)) {
      caughtAt = depth;
      return;
    }
    // Si el rival anota en su propia jugada la carrera queda sin sentido;
    // además evita scores > pointsToWin (claves Zobrist fuera de rango).
    if (scratch.winner || depth >= bound) return;
    const moves = scratch
      .generateMoves()
      .filter(
        (m) =>
          m.kind === "move" &&
          (nearPath(m.to) || nearPath(scratch.board.getPieceById(m.pieceId)!.position!)),
      );
    for (const m of moves) {
      if (++nodes > MAX_BFS_NODES) {
        budgetOut = true;
        return;
      }
      const u1 = scratch.make(m);
      const u2 = scratch.make({ kind: "pass" });
      dfs(depth + 1);
      scratch.unmake(u2);
      scratch.unmake(u1);
      if (caughtAt <= depth + 1 || budgetOut) return;
    }
  };
  dfs(0);

  // Presupuesto agotado: no se puede afirmar que es imparable.
  if (budgetOut) return result(none);
  const turnsToCatch = caughtAt === Infinity ? bound + 1 : caughtAt;
  return result({
    unstoppable: turnsToScore < turnsToCatch + tempo,
    turnsToScore,
    turnsToCatch,
  });
}

/** { self, opp }: valor de corredores imparables de cada bando (0.8 × punto). */
export function raceScoreSides(
  sb: SearchBoard,
  bot: Player,
  insight: RulesInsight,
): { self: number; opp: number } {
  const A = analyzeBoard(sb.board, sb.engine, insight);
  const sides = { self: 0, opp: 0 };
  for (const piece of sb.board.getAllPieces()) {
    if (!piece.position) continue;
    const info = analyzeRunner(sb, piece.id, insight, A);
    if (!info.unstoppable) continue;
    const bonus = 0.8 * MEDIUM_BOT_CONFIG.pointValue;
    if (piece.owner === bot) sides.self += bonus;
    else sides.opp += bonus;
  }
  return sides;
}

export function raceScore(sb: SearchBoard, bot: Player, insight: RulesInsight): number {
  const { self, opp } = raceScoreSides(sb, bot, insight);
  return self - opp;
}
