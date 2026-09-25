import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { MovementRuleEngine } from "../../application/rules/MovementRuleEngine";
import { getBenchPlacementSquares } from "../../application/rules/turnRules";
import {
  applySimBench,
  applySimMove,
  generateMoves,
  passTurn,
  type SimState,
} from "../../application/ai/sim/SimState";
import { rulesFromSnapshot, type GameRecord, type PlyRecord } from "./record";
import { encodePosition } from "./positionCodec";

/**
 * Árbitro de registros: reconstruye el estado inicial desde `record.setup` y
 * aplica plies con la misma semántica que la arena (banca libre, pase solo sin
 * acciones, bloqueo mutuo). Lo comparten `playRecordedGame` (valida cada acción
 * que graba), `replayGame` (verificación) y `computeSideMetrics`.
 *
 * Ids deterministas: la pieza colocada en el paso k de un jugador es
 * `${"w"|"n"}<k>`; la j-ésima banca elegida es `${"w"|"n"}b<j>`. El grabador y
 * el replayer las derivan igual, así las referencias `pieceId` de los plies
 * reproducen la pieza exacta.
 */
const piecePrefix = (p: Player): string => (p === Player.BLANCAS ? "w" : "n");
export const boardPieceId = (p: Player, placementStep: number): string =>
  `${piecePrefix(p)}${placementStep}`;
export const benchPieceId = (p: Player, benchIndex: number): string =>
  `${piecePrefix(p)}b${benchIndex}`;

/** Vista de la banca restante de un jugador (id → tipo), mutable al bajar. */
export interface BenchTracker {
  list(p: Player): readonly { id: string; type: PieceType }[];
  remove(p: Player, id: string): void;
}

/** ¿Tiene el jugador en turno alguna acción legal? (misma regla que la arena). */
export function hasAnyAction(state: SimState, engine: MovementRuleEngine): boolean {
  if (generateMoves(state, engine).length > 0) return true;
  const p = state.current;
  return (
    state.bench[p].length > 0 &&
    state.board.getPiecesOf(p).length < state.rules.piecesToPlace &&
    getBenchPlacementSquares(state.board, p, state.rules).length > 0
  );
}

export interface ReplayFrame {
  state: SimState;
  engine: MovementRuleEngine;
  bench: BenchTracker;
}

/** Lo mínimo que hace falta para reconstruir el estado inicial. */
export interface ReplaySource {
  rules: Pick<GameRecord["rules"], "view" | "pieceConfig">;
  setup: GameRecord["setup"];
}

/** Estado inicial reconstruido desde el registro (setup aplicado). */
export function initialSimFromRecord(record: ReplaySource): ReplayFrame {
  const rules = rulesFromSnapshot(record.rules.view);
  const engine = new MovementRuleEngine(record.rules.pieceConfig);
  const board = new Board(rules.width, rules.height);
  const benchLeft: Record<Player, { id: string; type: PieceType }[]> = {
    [Player.BLANCAS]: [],
    [Player.NEGRAS]: [],
  };
  for (const p of [Player.BLANCAS, Player.NEGRAS]) {
    const setup = record.setup[p];
    setup.order.forEach((boardIndex, step) => {
      const piece = setup.board[boardIndex];
      if (!piece) return;
      board.addPiece(
        new GamePiece(boardPieceId(p, step), piece.type, new Position(piece.x, piece.y), p),
      );
    });
    setup.bench.forEach((type, i) => benchLeft[p].push({ id: benchPieceId(p, i), type }));
  }
  const state: SimState = {
    rules,
    board,
    current: Player.BLANCAS,
    scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    bench: {
      [Player.BLANCAS]: [...record.setup[Player.BLANCAS].bench],
      [Player.NEGRAS]: [...record.setup[Player.NEGRAS].bench],
    },
    winner: null,
  };
  return { state, engine, bench: trackerOf(benchLeft) };
}

function trackerOf(left: Record<Player, { id: string; type: PieceType }[]>): BenchTracker {
  return {
    list: (p) => left[p],
    remove: (p, id) => {
      const i = left[p].findIndex((b) => b.id === id);
      if (i >= 0) left[p].splice(i, 1);
    },
  };
}

export type AppliedPly =
  | {
      ok: true;
      state: SimState;
      /** true si la acción consumió el turno. */
      consumesTurn: boolean;
      /** true si el pase cerró la partida por bloqueo mutuo. */
      blockedEnd: boolean;
      /** Tipo capturado por un move (si hubo). */
      capture?: PieceType;
      /** true si el move alcanzó la fila de anotación. */
      scored?: boolean;
    }
  | { ok: false; error: string };

/**
 * Aplica un ply del registro al estado, validando legalidad exactamente como
 * la arena. No muta `frame.state`. Actualiza `frame.bench` en bajadas.
 */
export function applyRecordedPly(
  frame: ReplayFrame,
  ply: Pick<PlyRecord, "player" | "kind" | "pieceId" | "type" | "to">,
): AppliedPly {
  const { state, engine } = frame;
  if (ply.player !== state.current) {
    return { ok: false, error: `turno: ply de ${ply.player} pero el turno es de ${state.current}` };
  }

  if (ply.kind === "move") {
    if (!ply.pieceId || !ply.to) return { ok: false, error: "move sin pieceId/to" };
    const moves = generateMoves(state, engine);
    const to = new Position(ply.to[0], ply.to[1]);
    const legal = moves.find((m) => m.pieceId === ply.pieceId && m.to.equals(to));
    if (!legal) {
      return {
        ok: false,
        error: `move ilegal: ${ply.player} ${ply.pieceId} → (${to.x},${to.y})`,
      };
    }
    return {
      ok: true,
      state: applySimMove(state, legal),
      consumesTurn: true,
      blockedEnd: false,
      capture: legal.capture,
      scored: legal.scores,
    };
  }

  if (ply.kind === "bench") {
    if (!ply.pieceId || ply.type === undefined || !ply.to) {
      return { ok: false, error: "bench sin pieceId/type/to" };
    }
    const held = frame.bench.list(state.current).find((b) => b.id === ply.pieceId);
    if (!held) return { ok: false, error: `bench: ${ply.player} no tiene ${ply.pieceId}` };
    if (held.type !== ply.type) {
      return { ok: false, error: `bench: ${ply.pieceId} es ${held.type}, no ${ply.type}` };
    }
    const to = new Position(ply.to[0], ply.to[1]);
    try {
      const next = applySimBench(state, ply.type, to, ply.pieceId);
      frame.bench.remove(state.current, ply.pieceId);
      return { ok: true, state: next, consumesTurn: false, blockedEnd: false };
    } catch (err) {
      return { ok: false, error: `bench ilegal: ${(err as Error).message}` };
    }
  }

  // pass: solo legal sin acciones.
  if (hasAnyAction(state, engine)) {
    return { ok: false, error: `pass ilegal: ${ply.player} aún tiene acciones legales` };
  }
  const passed = passTurn(state);
  if (hasAnyAction(passed, engine)) {
    return { ok: true, state: passed, consumesTurn: true, blockedEnd: false };
  }
  return { ok: true, state: passed, consumesTurn: true, blockedEnd: true };
}

export interface ReplayResult {
  ok: boolean;
  /** Índice del ply donde falló la reproducción (o plies.length si el resultado difiere). */
  mismatchAt?: number;
  error?: string;
}

/**
 * Re-juega una partida desde su registro: reconstruye reglas y tablero, aplica
 * cada ply verificando legalidad y `pos`, y compara el resultado final.
 */
export function replayGame(record: GameRecord): ReplayResult {
  const frame = initialSimFromRecord(record);
  let state = frame.state;
  let i = 0;
  let blockedEnd = false;
  for (; i < record.plies.length; i++) {
    const ply = record.plies[i]!;
    if (ply.n !== i) return { ok: false, mismatchAt: i, error: `ply.n ${ply.n} ≠ ${i}` };
    if (ply.pos !== undefined && ply.pos !== encodePosition(state)) {
      return { ok: false, mismatchAt: i, error: "pos no coincide con el estado" };
    }
    const applied = applyRecordedPly({ ...frame, state }, ply);
    if (!applied.ok) return { ok: false, mismatchAt: i, error: applied.error };
    state = applied.state;
    if (applied.blockedEnd) {
      blockedEnd = true;
      i++;
      break;
    }
  }
  const expectedWinner = blockedEnd ? null : state.winner;
  if (record.result.winner !== expectedWinner) {
    return {
      ok: false,
      mismatchAt: i,
      error: `winner: registro ${record.result.winner} vs replay ${expectedWinner}`,
    };
  }
  for (const p of [Player.BLANCAS, Player.NEGRAS]) {
    if (record.result.scores[p] !== state.scores[p]) {
      return { ok: false, mismatchAt: i, error: `score ${p} difiere` };
    }
  }
  if (record.result.plies !== i) {
    return { ok: false, mismatchAt: i, error: `plies: registro ${record.result.plies} vs ${i}` };
  }
  return { ok: true };
}
