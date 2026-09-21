import { Board } from "./Board";
import { GamePiece } from "./GamePiece";
import { Position } from "./Position";
import { PlayerState } from "./PlayerState";
import { MoveHistory, type MoveRecord } from "./MoveHistory";
import { PieceType, Player } from "../constants/PieceConstants";
import { GamePhase, SetupTurnMode } from "../constants/GameRules";
import { GAME_CONFIG } from "../constants/GameConstants";

export interface PieceSnapshot {
  id: string;
  type: PieceType;
  owner: Player;
  position: { x: number; y: number } | null;
}

export interface PlayerSnapshot {
  // Todos opcionales: RTDB no persiste arrays vacíos ni claves con valor null.
  selectedPieces?: PieceType[];
  placedPieces?: PieceSnapshot[];
  benchPieces?: PieceSnapshot[];
  score?: number;
}

export interface MoveRecordSnapshot {
  moveNumber: number;
  player: Player;
  pieceId: string;
  pieceType: PieceType;
  from: { x: number; y: number };
  to: { x: number; y: number };
  captured?: { pieceId: string; pieceType: PieceType; position: { x: number; y: number } };
  boardSnapshot: string;
  timestamp: string; // ISO 8601
}

export interface GameSnapshot {
  // board/moveHistory opcionales: RTDB elimina los arrays vacíos al escribir.
  board?: PieceSnapshot[];
  player1: PlayerSnapshot;
  player2: PlayerSnapshot;
  currentPlayer: Player;
  gamePhase: GamePhase;
  pieceIdCounter: number;
  moveHistory?: MoveRecordSnapshot[];
  setupMode?: SetupTurnMode;
  setupCompleted?: { player1: boolean; player2: boolean };
}

function pieceToSnapshot(piece: GamePiece): PieceSnapshot {
  return {
    id: piece.id,
    type: piece.type,
    owner: piece.owner,
    position: piece.position ? { x: piece.position.x, y: piece.position.y } : null,
  };
}

function pieceFromSnapshot(data: PieceSnapshot): GamePiece {
  return new GamePiece(
    data.id,
    data.type,
    data.position ? new Position(data.position.x, data.position.y) : null,
    data.owner,
  );
}

function moveRecordToSnapshot(record: MoveRecord): MoveRecordSnapshot {
  return {
    moveNumber: record.moveNumber,
    player: record.player,
    pieceId: record.pieceId,
    pieceType: record.pieceType,
    from: { x: record.from.x, y: record.from.y },
    to: { x: record.to.x, y: record.to.y },
    // Sin captured → la clave no se emite: RTDB rechaza valores undefined.
    ...(record.captured
      ? {
          captured: {
            pieceId: record.captured.pieceId,
            pieceType: record.captured.pieceType,
            position: { x: record.captured.position.x, y: record.captured.position.y },
          },
        }
      : {}),
    boardSnapshot: record.boardSnapshot,
    timestamp: record.timestamp.toISOString(),
  };
}

function moveRecordFromSnapshot(data: MoveRecordSnapshot): MoveRecord {
  return {
    moveNumber: data.moveNumber,
    player: data.player,
    pieceId: data.pieceId,
    pieceType: data.pieceType,
    from: new Position(data.from.x, data.from.y),
    to: new Position(data.to.x, data.to.y),
    captured: data.captured
      ? {
          pieceId: data.captured.pieceId,
          pieceType: data.captured.pieceType,
          position: new Position(data.captured.position.x, data.captured.position.y),
        }
      : undefined,
    boardSnapshot: data.boardSnapshot,
    timestamp: new Date(data.timestamp),
  };
}

export function boardFromPieceSnapshots(pieces: PieceSnapshot[]): Board {
  const board = new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
  pieces.forEach((pieceData) => {
    const piece = pieceFromSnapshot(pieceData);
    if (piece.position) {
      board.addPiece(piece);
    }
  });
  return board;
}

export interface GameSnapshotSource {
  board: Board;
  player1State: PlayerState;
  player2State: PlayerState;
  currentPlayer: Player;
  gamePhase: GamePhase;
  pieceIdCounter: number;
  moveHistory: MoveHistory;
  setupMode?: SetupTurnMode;
  setupCompleted?: { player1: boolean; player2: boolean };
}

export function serializeGameSnapshot(source: GameSnapshotSource): GameSnapshot {
  return {
    board: source.board.getAllPieces().map(pieceToSnapshot),
    player1: source.player1State.toSnapshot(),
    player2: source.player2State.toSnapshot(),
    currentPlayer: source.currentPlayer,
    gamePhase: source.gamePhase,
    pieceIdCounter: source.pieceIdCounter,
    moveHistory: source.moveHistory.getAllMoves().map(moveRecordToSnapshot),
    setupMode: source.setupMode ?? SetupTurnMode.ALTERNATING,
    setupCompleted: source.setupCompleted ?? { player1: false, player2: false },
  };
}

export interface DeserializedGameState {
  board: Board;
  player1State: PlayerState;
  player2State: PlayerState;
  currentPlayer: Player;
  gamePhase: GamePhase;
  pieceIdCounter: number;
  moveHistory: MoveHistory;
  setupMode: SetupTurnMode;
  setupCompleted: { player1: boolean; player2: boolean };
}

export function deserializeGameSnapshot(snap: GameSnapshot): DeserializedGameState {
  // Solo se exige la forma mínima: RTDB omite arrays/objetos vacíos, así que
  // `board`, `moveHistory` y los campos de cada player pueden venir ausentes.
  if (!snap || !snap.player1 || !snap.player2) {
    throw new Error("Malformed game snapshot");
  }

  const moveHistory = new MoveHistory();
  moveHistory.restore((snap.moveHistory ?? []).map(moveRecordFromSnapshot));

  return {
    board: boardFromPieceSnapshots(snap.board ?? []),
    player1State: PlayerState.fromSnapshot("player1", snap.player1),
    player2State: PlayerState.fromSnapshot("player2", snap.player2),
    currentPlayer: snap.currentPlayer,
    gamePhase: snap.gamePhase,
    pieceIdCounter: snap.pieceIdCounter,
    moveHistory,
    setupMode: snap.setupMode ?? SetupTurnMode.ALTERNATING,
    setupCompleted: snap.setupCompleted ?? { player1: false, player2: false },
  };
}
