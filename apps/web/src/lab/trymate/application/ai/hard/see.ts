import type { Board } from "../../../domain/entities/Board";
import type { GamePiece } from "../../../domain/entities/GamePiece";
import type { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import type { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import type { RulesInsight } from "../introspection/profiles";
import { cloneBoard, opponentOf } from "../sim/SimState";

const MAX_SWAP = 8;

const value = (piece: GamePiece, insight: RulesInsight): number =>
  insight.profiles.get(piece.type)?.value ?? 0;

const attackersOn = (
  board: Board,
  square: Position,
  side: Player,
  engine: MovementRuleEngine,
): GamePiece[] => {
  const list: GamePiece[] = [];
  for (const piece of board.getPiecesOf(side)) {
    if (!piece.position || piece.position.equals(square)) continue;
    if (engine.getCaptureSquares(piece, board).some((sq) => sq.equals(square))) {
      list.push(piece);
    }
  }
  return list;
};

/**
 * Intercambio estático sobre `square`: ganancia material neta para `side` si
 * inicia la secuencia de capturas. Cada bando entra con su atacante de menor
 * valor; se simula en un clon porque capturar puede (des)bloquear atacantes.
 * ≥ 0 = conviene iniciar.
 */
export function staticExchange(
  board: Board,
  square: Position,
  side: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
): number {
  const sim = cloneBoard(board);
  const victim = sim.getPieceAt(square);
  if (!victim || victim.owner === side) return 0;

  // s[i] = valor de la pieza parada en la casilla tras i capturas.
  const standing: number[] = [value(victim, insight)];
  let onSquare = victim;
  let mover = side;
  while (standing.length <= MAX_SWAP) {
    const attackers = attackersOn(sim, square, mover, engine);
    if (attackers.length === 0) break;
    let attacker = attackers[0]!;
    for (const a of attackers) {
      if (value(a, insight) < value(attacker, insight)) attacker = a;
    }
    sim.removePiece(onSquare.id);
    sim.movePiece(attacker.id, square);
    standing.push(value(attacker, insight));
    onSquare = attacker;
    mover = opponentOf(mover);
  }

  // Captura k gana standing[k-1]. V(k) = max(0, standing[k-1] − V(k+1)) para
  // k = n..2 (cada bando decide si continúa); el iniciador no tiene clamp:
  // SEE < 0 marca un intercambio perdedor.
  let v = 0;
  for (let i = standing.length - 1; i >= 2; i--) {
    v = Math.max(0, standing[i - 1]! - v);
  }
  return standing[0]! - v;
}

/**
 * Balance de intercambios por bando: `self` = Σ max(0, SEE) sobre piezas
 * rivales que `side` puede iniciar a capturar; `opp` = 0.5 × ídem del rival
 * sobre piezas de `side` (el rival decide cuándo, pesa menos).
 */
export function seeBySide(
  board: Board,
  side: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
): { self: number; opp: number } {
  const enemy = opponentOf(side);
  let self = 0;
  let opp = 0;
  for (const piece of board.getPiecesOf(enemy)) {
    if (!piece.position) continue;
    if (attackersOn(board, piece.position, side, engine).length === 0) continue;
    self += Math.max(0, staticExchange(board, piece.position, side, engine, insight));
  }
  for (const piece of board.getPiecesOf(side)) {
    if (!piece.position) continue;
    if (attackersOn(board, piece.position, enemy, engine).length === 0) continue;
    opp += Math.max(0, staticExchange(board, piece.position, enemy, engine, insight));
  }
  return { self, opp: opp * 0.5 };
}

export function seeBalance(
  board: Board,
  sideToMove: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
): number {
  const { self, opp } = seeBySide(board, sideToMove, engine, insight);
  return self - opp;
}
