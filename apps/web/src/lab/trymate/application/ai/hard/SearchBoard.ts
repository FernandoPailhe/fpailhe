import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import type { PieceType, Player } from "../../../domain/constants/PieceConstants";
import type { RulesView } from "../../../domain/config/RulesView";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { cloneBoard, opponentOf, type SimState } from "../sim/SimState";
import {
  createZobristKeys,
  fullHash,
  xorHash,
  type ZobristHash,
  type ZobristKeys,
} from "./zobrist";

export type { ZobristHash } from "./zobrist";

/** Acción atómica de la búsqueda Hard. `bench` es libre: no consume el turno. */
export type HardAction =
  | {
      kind: "move";
      pieceId: string;
      to: { x: number; y: number };
      /** Casilla origen: permite re-jugar la acción sobre un clon con ids distintos. */
      from?: { x: number; y: number };
    }
  | { kind: "bench"; type: PieceType; to: { x: number; y: number } }
  | { kind: "pass" };

/** Datos mínimos para revertir un `make` sin clonar nada. */
export interface Undo {
  action: HardAction;
  prevCurrent: Player;
  prevWinner: Player | null;
  prevScore: number;
  prevPiecesOnBoard: number;
  movedId?: string;
  from?: Position;
  captured?: GamePiece;
  scoredPiece?: GamePiece;
  benchId?: string;
  benchIndex?: number;
  prevHash: ZobristHash;
}

/**
 * Estado de búsqueda mutable con make/unmake (sin clonar el tablero por nodo).
 * `board` es un clon propio: nunca toca el tablero del store.
 */
export class SearchBoard {
  readonly rules: RulesView;
  readonly board: Board;
  readonly engine: MovementRuleEngine;
  current: Player;
  scores: Record<Player, number>;
  bench: Record<Player, PieceType[]>;
  winner: Player | null;
  piecesOnBoard: Record<Player, number>;
  hash: ZobristHash;
  readonly keys: ZobristKeys;
  private benchSeq = 0;

  constructor(sim: SimState, engine: MovementRuleEngine) {
    this.rules = sim.rules;
    this.engine = engine;
    this.board = cloneBoard(sim.board);
    this.current = sim.current;
    this.scores = { ...sim.scores };
    this.bench = { BLANCAS: [...sim.bench.BLANCAS], NEGRAS: [...sim.bench.NEGRAS] };
    this.winner = sim.winner;
    this.piecesOnBoard = {
      BLANCAS: 0,
      NEGRAS: 0,
    } as Record<Player, number>;
    for (const piece of this.board.getAllPieces()) {
      this.piecesOnBoard[piece.owner] += 1;
    }
    this.keys = createZobristKeys(this.rules);
    this.hash = fullHash(this, this.rules, this.keys);
  }

  /** Solo acciones "move" del jugador en turno. */
  generateMoves(): HardAction[] {
    const moves: HardAction[] = [];
    for (const piece of this.board.getPiecesOf(this.current)) {
      if (!piece.position) continue;
      for (const to of this.engine.getValidMoves(piece, this.board)) {
        moves.push({
          kind: "move",
          pieceId: piece.id,
          to: { x: to.x, y: to.y },
          from: { x: piece.position.x, y: piece.position.y },
        });
      }
    }
    return moves;
  }

  /** Bajadas válidas de banca (tipos distintos × casillas libres); [] si no puede. */
  generateBenchDrops(): HardAction[] {
    const list = this.bench[this.current];
    if (list.length === 0 || this.piecesOnBoard[this.current] >= this.rules.piecesToPlace) {
      return [];
    }
    const squares = getBenchPlacementSquares(this.board, this.current, this.rules);
    if (squares.length === 0) return [];
    const types = [...new Set(list)];
    const drops: HardAction[] = [];
    for (const type of types) {
      for (const to of squares) {
        drops.push({ kind: "bench", type, to: { x: to.x, y: to.y } });
      }
    }
    return drops;
  }

  make(action: HardAction): Undo {
    const undo: Undo = {
      action,
      prevCurrent: this.current,
      prevWinner: this.winner,
      prevScore: this.scores[this.current],
      prevPiecesOnBoard: this.piecesOnBoard[this.current],
      prevHash: this.hash,
    };
    if (action.kind === "pass") {
      this.current = opponentOf(this.current);
      this.hash = xorHash(this.hash, this.keys.side);
      return undo;
    }
    if (action.kind === "bench") {
      const legal = getBenchPlacementSquares(this.board, this.current, this.rules).some(
        (p) => p.x === action.to.x && p.y === action.to.y,
      );
      if (!legal || this.piecesOnBoard[this.current] >= this.rules.piecesToPlace) {
        throw new Error(`SearchBoard.make: bajada ilegal en (${action.to.x},${action.to.y})`);
      }
      const idx = this.bench[this.current].indexOf(action.type);
      if (idx < 0) {
        throw new Error(`SearchBoard.make: no hay ${action.type} en la banca de ${this.current}`);
      }
      const typeCount = this.bench[this.current].filter((t) => t === action.type).length;
      this.bench[this.current].splice(idx, 1);
      const id = `sb-bench-${this.benchSeq++}`;
      const piece = new GamePiece(
        id,
        action.type,
        new Position(action.to.x, action.to.y),
        this.current,
      );
      this.board.addPiece(piece);
      this.piecesOnBoard[this.current] += 1;
      undo.benchId = id;
      undo.benchIndex = idx;
      let h = xorHash(
        this.hash,
        this.keys.piece(action.type, this.current, action.to.x, action.to.y),
      );
      h = xorHash(h, this.keys.bench(this.current, action.type, typeCount));
      h = xorHash(h, this.keys.bench(this.current, action.type, typeCount - 1));
      this.hash = h;
      return undo;
    }
    // move
    let piece = this.board.getPieceById(action.pieceId);
    if (!piece?.position && action.from) {
      // Acción re-jugada sobre un clon (p.ej. PV de la TT): el id puede no
      // coincidir si la pieza salió de la banca — resolver por casilla origen.
      const at = this.board.getPieceAt(new Position(action.from.x, action.from.y));
      if (at?.owner === this.current) piece = at;
    }
    if (!piece?.position) {
      throw new Error(`SearchBoard.make: pieza ${action.pieceId} sin posición`);
    }
    undo.movedId = piece.id;
    undo.from = piece.position;
    const to = new Position(action.to.x, action.to.y);
    const target = this.board.getPieceAt(to);
    if (target && target.owner !== this.current) {
      undo.captured = target;
    }
    const scores = to.y === this.rules.scoringRow(this.current);
    let h = xorHash(this.hash, this.keys.piece(piece.type, piece.owner, undo.from.x, undo.from.y));
    if (undo.captured) {
      h = xorHash(h, this.keys.piece(undo.captured.type, undo.captured.owner, to.x, to.y));
    }
    this.board.movePiece(piece.id, to);
    if (undo.captured) {
      this.piecesOnBoard[undo.captured.owner] -= 1;
    }
    if (scores) {
      undo.scoredPiece = this.board.getPieceById(piece.id);
      this.board.removePiece(piece.id);
      this.piecesOnBoard[this.current] -= 1;
      h = xorHash(h, this.keys.score(this.current, this.scores[this.current]));
      this.scores[this.current] += 1;
      h = xorHash(h, this.keys.score(this.current, this.scores[this.current]));
      if (this.scores[this.current] >= this.rules.pointsToWin) {
        this.winner = this.current;
      }
    } else {
      h = xorHash(h, this.keys.piece(piece.type, piece.owner, to.x, to.y));
    }
    this.hash = xorHash(h, this.keys.side);
    this.current = opponentOf(this.current);
    return undo;
  }

  unmake(u: Undo): void {
    this.hash = u.prevHash; // zobrist: hash restaurado
    this.winner = u.prevWinner;
    this.scores[u.prevCurrent] = u.prevScore;
    this.piecesOnBoard[u.prevCurrent] = u.prevPiecesOnBoard;
    const a = u.action;
    if (a.kind === "bench") {
      this.board.removePiece(u.benchId!);
      this.bench[u.prevCurrent].splice(u.benchIndex!, 0, a.type);
    } else if (a.kind === "move") {
      if (u.scoredPiece) {
        this.board.addPiece(u.scoredPiece);
      }
      this.board.movePiece(u.movedId ?? a.pieceId, u.from!);
      if (u.captured) {
        this.board.addPiece(u.captured);
        this.piecesOnBoard[u.captured.owner] += 1;
      }
    }
    this.current = u.prevCurrent;
  }

  toSimState(): SimState {
    return {
      rules: this.rules,
      board: this.board,
      current: this.current,
      scores: { ...this.scores },
      bench: { BLANCAS: [...this.bench.BLANCAS], NEGRAS: [...this.bench.NEGRAS] },
      winner: this.winner,
    };
  }
}
