import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import type { RulesView } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { canPlaceFromBench, getBenchPlacementSquares } from "../../rules/turnRules";
import type { BotContext } from "../ComputerPlayer";

/**
 * Estado de partida puramente funcional para simular con cualquier RulesView,
 * sin el store (que está atado a las constantes globales). Nada muta: cada
 * apply devuelve un estado nuevo con el tablero clonado.
 */
export interface SimState {
  rules: RulesView;
  board: Board;
  current: Player;
  scores: Record<Player, number>;
  bench: Record<Player, PieceType[]>;
  winner: Player | null;
}

export interface SimMove {
  pieceId: string;
  from: Position;
  to: Position;
  capture?: PieceType;
  scores: boolean;
}

export const opponentOf = (p: Player): Player =>
  p === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;

export function cloneBoard(board: Board): Board {
  const copy = new Board(board.width, board.height);
  for (const piece of board.getAllPieces()) copy.addPiece(piece.clone());
  return copy;
}

/** SimState visto desde el turno del bot (`current = ctx.bot`). */
export function simFromContext(ctx: BotContext): SimState {
  const scores = {} as Record<Player, number>;
  const bench = {} as Record<Player, PieceType[]>;
  scores[ctx.bot] = ctx.botState.getScore();
  scores[opponentOf(ctx.bot)] = ctx.opponentState.getScore();
  bench[ctx.bot] = ctx.botState.getBenchPieces().map((p) => p.type);
  bench[opponentOf(ctx.bot)] = ctx.opponentState.getBenchPieces().map((p) => p.type);
  return {
    rules: ctx.rules,
    board: ctx.board,
    current: ctx.bot,
    scores,
    bench,
    winner: null,
  };
}

/** Todas las jugadas legales del jugador en turno, según `engine`. */
export function generateMoves(state: SimState, engine: MovementRuleEngine): SimMove[] {
  const moves: SimMove[] = [];
  const scoringRow = state.rules.scoringRow(state.current);
  for (const piece of state.board.getAllPieces()) {
    if (piece.owner !== state.current || !piece.position) continue;
    for (const to of engine.getValidMoves(piece, state.board)) {
      const target = state.board.getPieceAt(to);
      moves.push({
        pieceId: piece.id,
        from: piece.position,
        to,
        capture: target && target.owner !== state.current ? target.type : undefined,
        scores: to.y === scoringRow,
      });
    }
  }
  return moves;
}

/**
 * Aplica una jugada: mueve (capturando si hay rival), anota y retira la pieza
 * si llegó a la fila de anotación, fija `winner` al llegar a `pointsToWin` y
 * pasa el turno. No muta `state`.
 */
export function applySimMove(state: SimState, move: SimMove): SimState {
  const board = cloneBoard(state.board);
  board.movePiece(move.pieceId, move.to);

  const scores = { ...state.scores };
  let winner = state.winner;
  if (move.scores) {
    board.removePiece(move.pieceId);
    scores[state.current] += 1;
    if (scores[state.current] >= state.rules.pointsToWin) winner = state.current;
  }

  return {
    ...state,
    board,
    scores,
    bench: { ...state.bench },
    current: opponentOf(state.current),
    winner,
  };
}

/**
 * Baja una pieza de la banca a una casilla de despliegue (acción libre: NO
 * cambia el turno). Árbitro estricto: lanza si la bajada es ilegal.
 */
export function applySimBench(
  state: SimState,
  type: PieceType,
  to: Position,
  id: string,
): SimState {
  const benchList = state.bench[state.current];
  if (!benchList.includes(type)) {
    throw new Error(`applySimBench: ${state.current} no tiene un ${type} en la banca`);
  }
  const benchState = new PlayerState("sim");
  benchList.forEach((t, i) =>
    benchState.addBenchPiece(new GamePiece(`sim-bench-${i}`, t, null, state.current)),
  );
  if (!canPlaceFromBench(state.board, state.current, benchState, state.rules)) {
    throw new Error(`applySimBench: ${state.current} no puede bajar (tablero lleno o banca vacía)`);
  }
  const legal = getBenchPlacementSquares(state.board, state.current, state.rules).some((p) =>
    p.equals(to),
  );
  if (!legal) {
    throw new Error(
      `applySimBench: (${to.x},${to.y}) no es casilla de despliegue libre de ${state.current}`,
    );
  }

  const board = cloneBoard(state.board);
  board.addPiece(new GamePiece(id, type, to, state.current));
  const bench = {
    ...state.bench,
    [state.current]: benchList.filter((t, i) => i !== benchList.indexOf(type)),
  };
  return { ...state, board, bench };
}

export function passTurn(state: SimState): SimState {
  return { ...state, current: opponentOf(state.current) };
}
