import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./GameState";
import { Position } from "../domain/entities/Position";
import { Board } from "../domain/entities/Board";
import { GamePiece } from "../domain/entities/GamePiece";
import { PlayerState } from "../domain/entities/PlayerState";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GamePhase, GAME_RULES, GameMode } from "../domain/constants/GameRules";
import { GAME_CONFIG } from "../domain/constants/GameConstants";

const S = () => useGameStore.getState();
const pos = (x: number, y: number) => new Position(x, y);

const setupPlace = (type: PieceType, x: number, y: number) => {
  S().selectPieceTypeForSetup(type);
  S().handleTileClick(pos(x, y));
};

/** Full SETUP: both players place 5 pieces (F2 S2 P1) → BENCH_SELECTION. */
const runFullSetup = () => {
  const types = [
    PieceType.FORT,
    PieceType.STRIKER,
    PieceType.PIONEER,
    PieceType.FORT,
    PieceType.STRIKER,
  ];
  const whiteSpots = [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2), pos(0, 3)];
  const blackSpots = [pos(0, 7), pos(1, 7), pos(0, 8), pos(1, 8), pos(0, 9)];
  types.forEach((type, i) => {
    setupPlace(type, whiteSpots[i]!.x, whiteSpots[i]!.y);
    setupPlace(type, blackSpots[i]!.x, blackSpots[i]!.y);
  });
};

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("SETUP phase", () => {
  it("alternates players on each placement and uses per-side rows", () => {
    expect(S().gamePhase).toBe(GamePhase.SETUP);

    S().selectPieceTypeForSetup(PieceType.FORT);
    expect(S().validMoves.length).toBeGreaterThan(0);
    expect(
      S().validMoves.every((p) =>
        (GAME_RULES.PLACEMENT_ROWS_PLAYER1 as readonly number[]).includes(p.y),
      ),
    ).toBe(true);

    S().handleTileClick(pos(0, 1));
    expect(S().board.getPieceAt(pos(0, 1))?.type).toBe(PieceType.FORT);
    expect(S().currentPlayer).toBe(Player.NEGRAS);

    S().selectPieceTypeForSetup(PieceType.STRIKER);
    expect(
      S().validMoves.every((p) =>
        (GAME_RULES.PLACEMENT_ROWS_PLAYER2 as readonly number[]).includes(p.y),
      ),
    ).toBe(true);
  });

  it("enforces max 2 own pieces per row", () => {
    setupPlace(PieceType.FORT, 0, 1); // White
    setupPlace(PieceType.FORT, 0, 7); // Black
    setupPlace(PieceType.STRIKER, 1, 1); // White — row 1 now has 2 white pieces
    setupPlace(PieceType.STRIKER, 1, 7); // Black

    S().selectPieceTypeForSetup(PieceType.PIONEER); // White again
    expect(S().validMoves.every((p) => p.y !== 1)).toBe(true);
    expect(S().validMoves.length).toBeGreaterThan(0);
  });

  it("caps each piece type at 4 per player", () => {
    setupPlace(PieceType.FORT, 0, 1);
    setupPlace(PieceType.FORT, 0, 7);
    setupPlace(PieceType.FORT, 1, 1);
    setupPlace(PieceType.FORT, 1, 7);
    setupPlace(PieceType.FORT, 0, 2);
    setupPlace(PieceType.FORT, 0, 8);
    setupPlace(PieceType.FORT, 1, 2);
    setupPlace(PieceType.FORT, 1, 8);
    // White has 4 forts on the board — a 5th is not selectable
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().canSelectPieceType(PieceType.FORT)).toBe(false);
    expect(S().canSelectPieceType(PieceType.STRIKER)).toBe(true);
  });

  it("moves to BENCH_SELECTION after 10 placements", () => {
    runFullSetup();
    expect(S().gamePhase).toBe(GamePhase.BENCH_SELECTION);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().board.getAllPieces()).toHaveLength(10);
  });
});

describe("BENCH_SELECTION phase", () => {
  it("forces the per-type minimum and starts PLAYING after 6 picks", () => {
    runFullSetup();
    // White placed F2 S2 P1 — bench must include a PIONEER to reach min 2
    S().selectPieceTypeForBench(PieceType.FORT);
    S().selectPieceTypeForBench(PieceType.STRIKER);
    expect(S().canSelectBenchPieceType(PieceType.FORT)).toBe(false);
    expect(S().canSelectBenchPieceType(PieceType.PIONEER)).toBe(true);
    S().selectPieceTypeForBench(PieceType.PIONEER);
    expect(S().currentPlayer).toBe(Player.NEGRAS);

    S().selectPieceTypeForBench(PieceType.FORT);
    S().selectPieceTypeForBench(PieceType.STRIKER);
    S().selectPieceTypeForBench(PieceType.PIONEER);
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().player1State.getBenchPieces()).toHaveLength(3);
    expect(S().player2State.getBenchPieces()).toHaveLength(3);
  });
});

describe("quickStart", () => {
  it("enters PLAYING with a clean history and full armies", () => {
    S().quickStart();
    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(2, 4));
    S().handleTileClick(pos(2, 8));
    S().handleTileClick(pos(2, 6));
    S().goBackInHistory();
    expect(S().isViewingHistory).toBe(true);

    S().quickStart();
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    expect(S().board.getAllPieces()).toHaveLength(10);
    expect(S().player1State.getBenchPieces()).toHaveLength(3);
    expect(S().player2State.getBenchPieces()).toHaveLength(3);
    expect(S().isViewingHistory).toBe(false);
    expect(S().moveHistory.getTotalMoves()).toBe(0);
  });
});

describe("handleTileClick in PLAYING", () => {
  it("selects an own piece, moves it, and alternates the turn", () => {
    S().quickStart();
    S().handleTileClick(pos(2, 2)); // white pioneer
    expect(S().selectedPiece?.type).toBe(PieceType.PIONEER);
    expect(S().validMoves.length).toBeGreaterThan(0);

    S().handleTileClick(pos(2, 4));
    expect(S().board.getPieceAt(pos(2, 4))?.type).toBe(PieceType.PIONEER);
    expect(S().selectedPiece).toBeNull();
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().moveHistory.getTotalMoves()).toBe(1);
  });

  it("reselects another own piece and deselects on an empty click", () => {
    S().quickStart();
    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(1, 1)); // own fort
    expect(S().selectedPiece?.type).toBe(PieceType.FORT);

    S().handleTileClick(pos(2, 10)); // empty, unreachable
    expect(S().selectedPiece).toBeNull();
    expect(S().validMoves).toHaveLength(0);
  });
});

describe("bench placement", () => {
  it("places a bench piece as a free action that keeps the turn", () => {
    const board = new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
    const player1 = new PlayerState("player1");
    player1.addBenchPiece(new GamePiece("w-bench-1", PieceType.STRIKER, null, Player.BLANCAS));
    [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2)].forEach((p, i) => {
      board.addPiece(new GamePiece(`w-${i}`, PieceType.FORT, p, Player.BLANCAS));
    });
    useGameStore.setState({
      board,
      gamePhase: GamePhase.PLAYING,
      currentPlayer: Player.BLANCAS,
      player1State: player1,
      player2State: new PlayerState("player2"),
      selectedPiece: null,
      selectedBenchPiece: null,
      validMoves: [],
      blockedMoves: [],
    });

    expect(S().canPlaceBenchPiece()).toBe(true);
    S().handleTileClick(pos(2, 3)); // empty placement-row tile, row has 0 white pieces
    expect(S().board.getPieceAt(pos(2, 3))?.type).toBe(PieceType.STRIKER);
    expect(S().player1State.getBenchPieces()).toHaveLength(0);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });
});

describe("scoring", () => {
  it("scores and removes the piece when it reaches the last row", () => {
    const board = new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
    board.addPiece(new GamePiece("w-v", PieceType.STRIKER, pos(2, 9), Player.BLANCAS));
    board.addPiece(new GamePiece("b-b", PieceType.FORT, pos(0, 9), Player.NEGRAS));
    useGameStore.setState({
      board,
      gamePhase: GamePhase.PLAYING,
      currentPlayer: Player.BLANCAS,
      player1State: new PlayerState("player1"),
      player2State: new PlayerState("player2"),
      selectedPiece: null,
      selectedBenchPiece: null,
      validMoves: [],
      blockedMoves: [],
    });

    S().handleTileClick(pos(2, 9));
    expect(S().selectedPiece?.type).toBe(PieceType.STRIKER);
    S().handleTileClick(pos(2, 10));

    expect(S().player1State.getScore()).toBe(1);
    expect(S().board.getPieceAt(pos(2, 10))).toBeUndefined();
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
  });
});

describe("game over", () => {
  it("ends when a player reaches POINTS_TO_WIN", () => {
    S().quickStart();
    S().player1State.incrementScore();
    S().player1State.incrementScore();
    S().player1State.incrementScore();
    S().checkGameOver();
    expect(S().gamePhase).toBe(GamePhase.GAME_OVER);
  });

  it("ends when neither side has legal moves", () => {
    useGameStore.setState({
      board: new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT),
      gamePhase: GamePhase.PLAYING,
    });
    S().checkGameOver();
    expect(S().gamePhase).toBe(GamePhase.GAME_OVER);
  });
});

describe("move history", () => {
  const playTwoMoves = () => {
    S().quickStart();
    S().handleTileClick(pos(2, 2)); // select white pioneer
    S().handleTileClick(pos(2, 4)); // move
    S().handleTileClick(pos(2, 8)); // select black pioneer
    S().handleTileClick(pos(2, 6)); // move
  };

  it("navigates back, locks the board read-only, and returns to present", () => {
    playTwoMoves();
    expect(S().moveHistory.getTotalMoves()).toBe(2);

    S().goBackInHistory();
    expect(S().isViewingHistory).toBe(true);
    // Board shows the snapshot after move 1: black pioneer is back at (2,8)
    expect(S().board.getPieceAt(pos(2, 8))?.type).toBe(PieceType.PIONEER);
    expect(S().board.getPieceAt(pos(2, 6))).toBeUndefined();

    // Locked while viewing history
    S().handleTileClick(pos(1, 9));
    expect(S().selectedPiece).toBeNull();
    expect(S().board.getPieceAt(pos(1, 9))?.type).toBe(PieceType.FORT);

    S().returnToPresent();
    expect(S().isViewingHistory).toBe(false);
    expect(S().board.getPieceAt(pos(2, 6))?.type).toBe(PieceType.PIONEER);
    expect(S().board.getPieceAt(pos(2, 8))).toBeUndefined();
  });
});

describe("online mode", () => {
  it("setOnlineContext sets ONLINE mode and localPlayer", () => {
    S().setOnlineContext("room-1", Player.BLANCAS);
    expect(S().gameMode).toBe(GameMode.ONLINE);
    expect(S().roomId).toBe("room-1");
    expect(S().localPlayer).toBe(Player.BLANCAS);
    expect(S().isLocalPlayerTurn()).toBe(true); // BLANCAS starts
  });

  it("blocks every interaction path for the inactive player", () => {
    S().setOnlineContext("room-1", Player.NEGRAS); // guest; BLANCAS has the turn
    expect(S().isLocalPlayerTurn()).toBe(false);

    // Board path
    S().handleTileClick(pos(0, 7));
    expect(S().board.getPieceAt(pos(0, 7))).toBeUndefined();
    expect(S().selectedPieceTypeForPlacement).toBeNull();

    // Picker paths
    expect(S().canSelectPieceType(PieceType.FORT)).toBe(false);
    S().selectPieceTypeForSetup(PieceType.FORT);
    expect(S().selectedPieceTypeForPlacement).toBeNull();
    expect(S().canSelectBenchPieceType(PieceType.FORT)).toBe(false);
    S().selectPieceTypeForBench(PieceType.FORT);
    expect(S().player2State.getBenchPieces()).toHaveLength(0);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });

  it("blocks the board in PLAYING when it is not the local turn", () => {
    S().quickStart();
    S().setOnlineContext("room-1", Player.NEGRAS); // BLANCAS to move
    expect(S().isLocalPlayerTurn()).toBe(false);
    expect(S().canPlaceBenchPiece()).toBe(false);

    S().handleTileClick(pos(2, 2)); // white pioneer
    expect(S().selectedPiece).toBeNull();
    S().handleTileClick(pos(2, 4));
    expect(S().board.getPieceAt(pos(2, 4))).toBeUndefined();
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });

  it("applyRemoteSnapshot restores state and re-enables the turn", () => {
    S().quickStart();
    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(2, 4)); // BLANCAS moves → NEGRAS to move
    const snap = S().toSnapshot();

    S().reset();
    S().setOnlineContext("room-1", Player.NEGRAS);
    expect(S().isLocalPlayerTurn()).toBe(false); // fresh SETUP: BLANCAS to move
    S().applyRemoteSnapshot(snap); // remote state is authoritative: NEGRAS to move

    expect(S().board.getPieceAt(pos(2, 4))?.type).toBe(PieceType.PIONEER);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    expect(S().moveHistory.getTotalMoves()).toBe(1);

    // NEGRAS can act on the applied state
    S().handleTileClick(pos(2, 8));
    expect(S().selectedPiece?.type).toBe(PieceType.PIONEER);
    S().handleTileClick(pos(2, 6));
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().isLocalPlayerTurn()).toBe(false);
  });

  it("toSnapshot + applyRemoteSnapshot is a store-level round trip", () => {
    S().quickStart();
    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(2, 4));
    const snap = S().toSnapshot();

    S().reset();
    S().applyRemoteSnapshot(snap);
    expect(S().board.getAllPieces()).toHaveLength(10);
    expect(S().player1State.getBenchPieces()).toHaveLength(3);
    expect(S().player2State.getBenchPieces()).toHaveLength(3);
    expect(S().pieceIdCounter).toBe(snap.pieceIdCounter);
    expect(S().moveHistory.getTotalMoves()).toBe(1);
  });

  it("reset() clears the online context and returns to PVP", () => {
    S().setOnlineContext("room-1", Player.NEGRAS);
    S().reset();
    expect(S().gameMode).toBe(GameMode.PVP);
    expect(S().roomId).toBeNull();
    expect(S().localPlayer).toBeNull();
    expect(S().isLocalPlayerTurn()).toBe(true);
  });
});

describe("reset", () => {
  it("clears the game including history state", () => {
    S().quickStart();
    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(2, 4));
    S().handleTileClick(pos(2, 8));
    S().handleTileClick(pos(2, 6));
    S().goBackInHistory();
    expect(S().isViewingHistory).toBe(true);

    S().reset();
    expect(S().gamePhase).toBe(GamePhase.SETUP);
    expect(S().player1State.getScore()).toBe(0);
    expect(S().player2State.getScore()).toBe(0);
    expect(S().board.getAllPieces()).toHaveLength(0);
    expect(S().moveHistory.getTotalMoves()).toBe(0);
    expect(S().isViewingHistory).toBe(false);
    expect(S().selectedPiece).toBeNull();
    expect(S().selectedBenchPiece).toBeNull();
  });
});
