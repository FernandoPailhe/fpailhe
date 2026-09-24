import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import type { PieceType } from "../../../domain/constants/PieceConstants";
import { rulesFingerprint, type RulesView } from "../../../domain/config/RulesView";
import type { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { opponentOf } from "../sim/SimState";

export type PieceRole = "runner" | "attacker" | "blocker";

/**
 * Lo que el bot descubre de un tipo de pieza sondeando el motor: nada de esto
 * está escrito a mano — si cambia un patrón de movimiento o de bloqueo, el
 * perfil cambia solo.
 */
export interface PieceProfile {
  type: PieceType;
  /** Jugadas legales en tablero vacío desde el centro. */
  moveCount: number;
  /** Máximo avance de progreso en una sola jugada. */
  forwardReach: number;
  /** Máximo desplazamiento lateral en una jugada. */
  lateralReach: number;
  /** Casillas que capturaría desde el centro. */
  captureCount: number;
  /** Alcance Chebyshev máximo de sus capturas. */
  captureReach: number;
  /** Casillas vecinas que niega a un rival que entra (promedio por tipo). */
  blockPower: number;
  /** Valor de material derivado (media ≈ 30 entre tipos) u override. */
  value: number;
  roles: ReadonlySet<PieceRole>;
}

/** Umbrales relativos al tablero y a los perfiles (nunca literales). */
export interface InsightGeometry {
  runnerZone: number;
  laneWindow: number;
  supportRadius: number;
  endgamePieces: number;
  stretchSlack: number;
}

export interface RulesInsight {
  rules: RulesView;
  profiles: ReadonlyMap<PieceType, PieceProfile>;
  /**
   * En [−1, 1]: positivo = `attacker` amenaza a `target` desde casillas donde
   * el target no puede responder; negativo = lo contrario.
   */
  matchup: (attacker: PieceType, target: PieceType) => number;
  geometry: InsightGeometry;
  /** Filas avanzadas desde la fila base del dueño. */
  progress(piece: GamePiece): number;
  /** Filas que le faltan para anotar. */
  distToGoal(piece: GamePiece): number;
}

const INSIGHTS = new Map<string, RulesInsight>();

const key = (x: number, y: number): string => `${x},${y}`;

/**
 * Insight memoizado por `rulesFingerprint(rules, pieceConfig)` + overrides:
 * mismas reglas/config devuelven el mismo objeto (seguro de compartir).
 */
export function getRulesInsight(
  rules: RulesView,
  engine: MovementRuleEngine,
  pieceConfigForFingerprint: unknown,
  valueOverrides: Partial<Record<string, number>> = {},
): RulesInsight {
  const cacheKey =
    rulesFingerprint(rules, pieceConfigForFingerprint) + "|" + JSON.stringify(valueOverrides);
  const cached = INSIGHTS.get(cacheKey);
  if (cached) return cached;
  const insight = buildInsight(rules, engine, valueOverrides);
  INSIGHTS.set(cacheKey, insight);
  return insight;
}

interface ProbeStats {
  moveCount: number;
  forwardReach: number;
  lateralReach: number;
  captureCount: number;
  captureReach: number;
  blockPower: number;
}

/**
 * blockPower: para cada vecina N de la pieza y cada tipo rival E, una sonda
 * enemiga parada una fila antes de entrar a N intenta pasar; cuenta cuántas
 * entradas niega la pieza (promedio por tipo rival).
 */
function probeBlockPower(
  probe: GamePiece,
  board: Board,
  engine: MovementRuleEngine,
  rules: RulesView,
  enemy: Player,
): number {
  const center = probe.position!;
  let denied = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx < 0 || ny < 0 || nx >= rules.width || ny >= rules.height) continue;
      const square = new Position(nx, ny);
      // La sonda rival entra a `square` avanzando: parte una fila "atrás".
      const probeY = ny - rules.forward(enemy);
      if (probeY < 0 || probeY >= rules.height) continue;
      if (nx === center.x && probeY === center.y) continue;
      for (const type of rules.pieceTypes) {
        const enemyProbe = new GamePiece("probe-e", type, new Position(nx, probeY), enemy);
        if (!engine.canPassThrough(enemyProbe, square, board)) denied++;
      }
    }
  }
  return denied / rules.pieceTypes.length;
}

/**
 * matchup(T, E): E (rival del bando de sondeo) en el centro; cuenta casillas
 * S donde T ataca a E sin que E ataque S (a) y viceversa (b).
 * Resultado = (a − b) / max(1, a + b).
 */
function probeMatchups(
  rules: RulesView,
  engine: MovementRuleEngine,
): Map<PieceType, Map<PieceType, number>> {
  const home = Player.BLANCAS;
  const enemy = opponentOf(home);
  const center = new Position(Math.floor(rules.width / 2), Math.floor(rules.height / 2));
  const matrix = new Map<PieceType, Map<PieceType, number>>();

  for (const target of rules.pieceTypes) {
    const board = new Board(rules.width, rules.height);
    const targetPiece = new GamePiece("probe-target", target, center, enemy);
    board.addPiece(targetPiece);
    const targetAttacks = new Set(
      engine.getCaptureSquares(targetPiece, board).map((s) => key(s.x, s.y)),
    );

    for (const attacker of rules.pieceTypes) {
      let safe = 0;
      let unsafe = 0;
      for (let x = 0; x < rules.width; x++) {
        for (let y = 0; y < rules.height; y++) {
          if (x === center.x && y === center.y) continue;
          const square = new Position(x, y);
          const probe = new GamePiece("probe-a", attacker, square, home);
          const attacksTarget = engine
            .getCaptureSquares(probe, board)
            .some((sq) => sq.equals(center));
          const targetAttacksSquare = targetAttacks.has(key(x, y));
          if (attacksTarget && !targetAttacksSquare) safe++;
          else if (targetAttacksSquare && !attacksTarget) unsafe++;
        }
      }
      let row = matrix.get(attacker);
      if (!row) {
        row = new Map();
        matrix.set(attacker, row);
      }
      row.set(target, (safe - unsafe) / Math.max(1, safe + unsafe));
    }
  }
  return matrix;
}

function buildInsight(
  rules: RulesView,
  engine: MovementRuleEngine,
  valueOverrides: Partial<Record<string, number>>,
): RulesInsight {
  const home = Player.BLANCAS;
  const enemy = opponentOf(home);
  const center = new Position(Math.floor(rules.width / 2), Math.floor(rules.height / 2));

  // Sondeo por tipo en tablero vacío, pieza en el centro para no recortar
  // alcances contra los bordes.
  const stats = new Map<PieceType, ProbeStats>();
  for (const type of rules.pieceTypes) {
    const board = new Board(rules.width, rules.height);
    const probe = new GamePiece("probe", type, center, home);
    board.addPiece(probe);
    const moves = engine.getValidMoves(probe, board);
    const captures = engine.getCaptureSquares(probe, board);
    stats.set(type, {
      moveCount: moves.length,
      forwardReach: moves.reduce(
        (max, to) => Math.max(max, (to.y - center.y) * rules.forward(home)),
        0,
      ),
      lateralReach: moves.reduce((max, to) => Math.max(max, Math.abs(to.x - center.x)), 0),
      captureCount: captures.length,
      captureReach: captures.reduce(
        (max, sq) => Math.max(max, Math.abs(sq.x - center.x), Math.abs(sq.y - center.y)),
        0,
      ),
      blockPower: probeBlockPower(probe, board, engine, rules, enemy),
    });
  }

  // Valor derivado, normalizado a media 30; overrides por nombre de tipo.
  const rawValues = new Map<PieceType, number>();
  for (const type of rules.pieceTypes) {
    const s = stats.get(type)!;
    rawValues.set(
      type,
      20 + 2 * s.moveCount + 5 * s.captureCount + 3 * s.forwardReach + 4 * s.blockPower,
    );
  }
  const mean =
    rules.pieceTypes.reduce((sum, t) => sum + rawValues.get(t)!, 0) /
    Math.max(1, rules.pieceTypes.length);
  const scale = mean > 0 ? 30 / mean : 1;

  const maxForwardReach = rules.pieceTypes.reduce(
    (max, t) => Math.max(max, stats.get(t)!.forwardReach),
    0,
  );

  const profiles = new Map<PieceType, PieceProfile>();
  for (const type of rules.pieceTypes) {
    const s = stats.get(type)!;
    const roles = new Set<PieceRole>();
    if (s.captureCount > 0) roles.add("attacker");
    if (s.blockPower > 0) roles.add("blocker");
    if (s.captureCount === 0 || s.forwardReach === maxForwardReach) roles.add("runner");
    profiles.set(type, {
      type,
      ...s,
      value:
        valueOverrides[type as string] ??
        Math.round((rawValues.get(type) ?? 0) * scale * 100) / 100,
      roles,
    });
  }

  const matrix = probeMatchups(rules, engine);
  const maxLateral = rules.pieceTypes.reduce(
    (max, t) => Math.max(max, stats.get(t)!.lateralReach),
    0,
  );
  const maxCaptureReach = rules.pieceTypes.reduce(
    (max, t) => Math.max(max, stats.get(t)!.captureReach),
    0,
  );

  return {
    rules,
    profiles,
    matchup: (attacker, target) => matrix.get(attacker)?.get(target) ?? 0,
    geometry: {
      runnerZone: Math.max(2, Math.round(0.3 * (rules.height - 1))),
      laneWindow: Math.max(1, maxLateral),
      supportRadius: maxCaptureReach + 1,
      endgamePieces: Math.round(0.6 * 2 * rules.piecesToPlace),
      stretchSlack: Math.max(2, Math.round(0.2 * rules.height)),
    },
    progress: (piece) =>
      piece.position ? Math.abs(piece.position.y - rules.homeRow(piece.owner)) : 0,
    distToGoal: (piece) =>
      piece.position ? Math.abs(rules.scoringRow(piece.owner) - piece.position.y) : rules.height,
  };
}
