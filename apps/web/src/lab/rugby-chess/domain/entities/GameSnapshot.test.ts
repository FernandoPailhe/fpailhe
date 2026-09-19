import { describe, expect, it } from "vitest";
import { Board } from "./Board";
import { GamePiece } from "./GamePiece";
import { Position } from "./Position";
import { PlayerState } from "./PlayerState";
import { MoveHistory, type MoveRecord } from "./MoveHistory";
import { PieceType, Player } from "../constants/PieceConstants";
import { GamePhase } from "../constants/GameRules";
import { GAME_CONFIG } from "../constants/GameConstants";
import {
  deserializeGameSnapshot,
  serializeGameSnapshot,
  type GameSnapshotSource,
} from "./GameSnapshot";

const pos = (x: number, y: number) => new Position(x, y);

function emptySource(): GameSnapshotSource {
  return {
    board: new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT),
    player1State: new PlayerState("player1"),
    player2State: new PlayerState("player2"),
    currentPlayer: Player.BLANCAS,
    gamePhase: GamePhase.SETUP,
    pieceIdCounter: 0,
    moveHistory: new MoveHistory(),
  };
}

function midGameSource(): GameSnapshotSource {
  const source = emptySource();

  const w1 = new GamePiece("w-0", PieceType.BULWARK, pos(0, 1), Player.BLANCAS);
  const w2 = new GamePiece("w-1", PieceType.APEX, pos(2, 4), Player.BLANCAS);
  const b1 = new GamePiece("b-0", PieceType.VANGUARD, pos(3, 9), Player.NEGRAS);
  [w1, w2, b1].forEach((p) => source.board.addPiece(p));

  [w1, w2].forEach((p) => source.player1State.addPlacedPiece(p));
  source.player1State.addSelectedPiece(PieceType.BULWARK);
  source.player1State.addSelectedPiece(PieceType.APEX);
  source.player1State.addBenchPiece(
    new GamePiece("w-bench-0", PieceType.VANGUARD, null, Player.BLANCAS),
  );
  source.player1State.incrementScore();

  source.player2State.addPlacedPiece(b1);
  source.player2State.addSelectedPiece(PieceType.VANGUARD);

  const record: MoveRecord = {
    moveNumber: 1,
    player: Player.BLANCAS,
    pieceId: "w-1",
    pieceType: PieceType.APEX,
    from: pos(2, 2),
    to: pos(2, 4),
    boardSnapshot: JSON.stringify([
      { id: "w-0", type: PieceType.BULWARK, owner: Player.BLANCAS, position: { x: 0, y: 1 } },
      { id: "w-1", type: PieceType.APEX, owner: Player.BLANCAS, position: { x: 2, y: 4 } },
      { id: "b-0", type: PieceType.VANGUARD, owner: Player.NEGRAS, position: { x: 3, y: 9 } },
    ]),
    timestamp: new Date("2026-09-19T12:00:00.000Z"),
  };
  source.moveHistory.addMove(record);

  source.currentPlayer = Player.NEGRAS;
  source.gamePhase = GamePhase.PLAYING;
  source.pieceIdCounter = 7;
  return source;
}

describe("GameSnapshot", () => {
  it("round-trips an initial SETUP state", () => {
    const snap = serializeGameSnapshot(emptySource());
    const restored = deserializeGameSnapshot(snap);
    const reserialized = serializeGameSnapshot({
      board: restored.board,
      player1State: restored.player1State,
      player2State: restored.player2State,
      currentPlayer: restored.currentPlayer,
      gamePhase: restored.gamePhase,
      pieceIdCounter: restored.pieceIdCounter,
      moveHistory: restored.moveHistory,
    });
    expect(reserialized).toEqual(snap);
  });

  it("round-trips a mid-game state with pieces, bench, score and history", () => {
    const snap = serializeGameSnapshot(midGameSource());
    // Simulate the RTDB round trip: plain JSON in, plain JSON out.
    const wire = JSON.parse(JSON.stringify(snap));
    const restored = deserializeGameSnapshot(wire);

    expect(restored.gamePhase).toBe(GamePhase.PLAYING);
    expect(restored.currentPlayer).toBe(Player.NEGRAS);
    expect(restored.pieceIdCounter).toBe(7);

    const pieces = restored.board.getAllPieces();
    expect(pieces).toHaveLength(3);
    const apex = restored.board.getPieceById("w-1");
    expect(apex?.type).toBe(PieceType.APEX);
    expect(apex?.position?.equals(pos(2, 4))).toBe(true);

    expect(restored.player1State.getScore()).toBe(1);
    expect(restored.player1State.getSelectedPieces()).toEqual([
      PieceType.BULWARK,
      PieceType.APEX,
    ]);
    expect(restored.player1State.getPlacedPieces()).toHaveLength(2);
    expect(restored.player1State.getBenchPieces()).toHaveLength(1);
    expect(restored.player1State.getBenchPieces()[0]?.id).toBe("w-bench-0");
    expect(restored.player1State.getBenchPieces()[0]?.position).toBeNull();
    expect(restored.player2State.getPlacedPieces()).toHaveLength(1);

    expect(restored.moveHistory.getTotalMoves()).toBe(1);
    const move = restored.moveHistory.getCurrentMove();
    expect(move?.pieceId).toBe("w-1");
    expect(move?.from.equals(pos(2, 2))).toBe(true);
    expect(move?.to.equals(pos(2, 4))).toBe(true);
    expect(move?.timestamp.toISOString()).toBe("2026-09-19T12:00:00.000Z");
    expect(restored.moveHistory.isViewingHistory()).toBe(false);
  });

  it("round-trips a move record with a captured piece", () => {
    const source = midGameSource();
    source.moveHistory.addMove({
      moveNumber: 2,
      player: Player.NEGRAS,
      pieceId: "b-0",
      pieceType: PieceType.VANGUARD,
      from: pos(3, 9),
      to: pos(2, 4),
      captured: { pieceId: "w-1", pieceType: PieceType.APEX, position: pos(2, 4) },
      boardSnapshot: "[]",
      timestamp: new Date("2026-09-19T12:05:00.000Z"),
    });

    const wire = JSON.parse(JSON.stringify(serializeGameSnapshot(source)));
    const restored = deserializeGameSnapshot(wire);
    const move = restored.moveHistory.getCurrentMove();
    expect(move?.captured?.pieceId).toBe("w-1");
    expect(move?.captured?.position.equals(pos(2, 4))).toBe(true);
  });

  it("throws on malformed snapshots", () => {
    expect(() => deserializeGameSnapshot(null as never)).toThrow("Malformed game snapshot");
    expect(() => deserializeGameSnapshot({} as never)).toThrow("Malformed game snapshot");
    expect(() =>
      deserializeGameSnapshot({ board: [], player1: {}, player2: {} } as never),
    ).toThrow("Malformed game snapshot");
  });
});
