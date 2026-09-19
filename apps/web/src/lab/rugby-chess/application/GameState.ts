import { create } from "zustand";
import { Board } from "../domain/entities/Board";
import { Position } from "../domain/entities/Position";
import { GamePiece } from "../domain/entities/GamePiece";
import { PlayerState } from "../domain/entities/PlayerState";
import { IGameState } from "../domain/interfaces/IGameState";
import { GAME_CONFIG } from "../domain/constants/GameConstants";
import { Player, PieceType } from "../domain/constants/PieceConstants";
import { GamePhase, GAME_RULES, GameMode } from "../domain/constants/GameRules";
import { MovementRuleEngine } from "./rules/MovementRuleEngine";
import { MoveHistory, MoveRecord } from "../domain/entities/MoveHistory";
import {
  boardFromPieceSnapshots,
  deserializeGameSnapshot,
  serializeGameSnapshot,
  type GameSnapshot,
  type PieceSnapshot,
} from "../domain/entities/GameSnapshot";

interface GameStateStore {
  board: Board;
  gamePhase: GamePhase;
  gameMode: GameMode;
  currentPlayer: Player;
  player1State: PlayerState;
  player2State: PlayerState;
  selectedPiece: GamePiece | null;
  selectedPieceTypeForPlacement: PieceType | null;
  selectedBenchPiece: GamePiece | null;
  validMoves: Position[];
  blockedMoves: Position[];
  movementEngine: MovementRuleEngine;
  pieceIdCounter: number;
  moveHistory: MoveHistory;
  isViewingHistory: boolean;
  /** Bando que controla este cliente en ONLINE; null = modo local. */
  localPlayer: Player | null;
  roomId: string | null;

  selectPieceTypeForSetup: (type: PieceType) => void;
  selectPieceTypeForBench: (type: PieceType) => void;
  placePieceInSetup: (position: Position) => void;
  placeBenchPiece: (position: Position) => void;
  selectBenchPiece: (benchPiece: GamePiece) => void;
  selectTile: (position: Position) => void;
  handleTileClick: (position: Position) => void;
  hoverTile: (position: Position | null) => void;
  movePiece: (to: Position) => void;
  startGame: () => void;
  reset: () => void;
  quickStart: () => void;
  getCurrentPlayerState: () => PlayerState;
  getOpponentPlayerState: () => PlayerState;
  checkScoring: (piece: GamePiece) => void;
  checkGameOver: () => void;
  canSelectPieceType: (type: PieceType) => boolean;
  canSelectBenchPieceType: (type: PieceType) => boolean;
  canPlaceBenchPiece: () => boolean;
  setGameMode: (mode: GameMode) => void;
  goBackInHistory: () => void;
  goForwardInHistory: () => void;
  returnToPresent: () => void;
  getMoveHistory: () => MoveRecord[];
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  isLocalPlayerTurn: () => boolean;
  setOnlineContext: (roomId: string | null, localPlayer: Player | null) => void;
  applyRemoteSnapshot: (snapshot: GameSnapshot) => void;
  toSnapshot: () => GameSnapshot;
}

const createInitialBoard = (): Board => {
  return new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
};

function restoreBoardFromSnapshot(json: string): Board {
  return boardFromPieceSnapshots(JSON.parse(json) as PieceSnapshot[]);
}

export const useGameStore = create<GameStateStore>((set, get) => ({
  board: createInitialBoard(),
  gamePhase: GamePhase.SETUP,
  gameMode: GameMode.PVP,
  currentPlayer: Player.BLANCAS,
  player1State: new PlayerState("player1"),
  player2State: new PlayerState("player2"),
  selectedPiece: null,
  selectedPieceTypeForPlacement: null,
  selectedBenchPiece: null,
  validMoves: [],
  blockedMoves: [],
  movementEngine: new MovementRuleEngine(),
  pieceIdCounter: 0,
  moveHistory: new MoveHistory(),
  isViewingHistory: false,
  localPlayer: null,
  roomId: null,

  isLocalPlayerTurn: () => {
    const state = get();
    return (
      state.gameMode !== GameMode.ONLINE ||
      state.localPlayer === null ||
      state.localPlayer === state.currentPlayer
    );
  },

  setOnlineContext: (roomId: string | null, localPlayer: Player | null) => {
    set({
      roomId,
      localPlayer,
      gameMode: roomId ? GameMode.ONLINE : GameMode.PVP,
    });
  },

  applyRemoteSnapshot: (snapshot: GameSnapshot) => {
    const restored = deserializeGameSnapshot(snapshot);
    set({
      board: restored.board,
      player1State: restored.player1State,
      player2State: restored.player2State,
      currentPlayer: restored.currentPlayer,
      gamePhase: restored.gamePhase,
      pieceIdCounter: restored.pieceIdCounter,
      moveHistory: restored.moveHistory,
      selectedPiece: null,
      selectedPieceTypeForPlacement: null,
      selectedBenchPiece: null,
      validMoves: [],
      blockedMoves: [],
      isViewingHistory: false,
    });
  },

  toSnapshot: () => {
    const state = get();
    return serializeGameSnapshot({
      board: state.board,
      player1State: state.player1State,
      player2State: state.player2State,
      currentPlayer: state.currentPlayer,
      gamePhase: state.gamePhase,
      pieceIdCounter: state.pieceIdCounter,
      moveHistory: state.moveHistory,
    });
  },

  getCurrentPlayerState: () => {
    const state = get();
    return state.currentPlayer === Player.BLANCAS ? state.player1State : state.player2State;
  },

  getOpponentPlayerState: () => {
    const state = get();
    return state.currentPlayer === Player.BLANCAS ? state.player2State : state.player1State;
  },

  canSelectPieceType: (type: PieceType) => {
    const state = get();
    if (!state.isLocalPlayerTurn()) return false;
    if (state.gamePhase !== GamePhase.SETUP) return false;
    if (state.selectedPieceTypeForPlacement !== null) return false;

    const playerState = state.getCurrentPlayerState();
    const currentCount = playerState.getSelectedPieceCount(type);

    if (currentCount >= GAME_RULES.MAX_PIECES_PER_TYPE) return false;
    if (playerState.getTotalSelectedCount() >= GAME_RULES.TOTAL_PIECES_PER_PLAYER) return false;

    return true;
  },

  canSelectBenchPieceType: (type: PieceType) => {
    const state = get();
    if (!state.isLocalPlayerTurn()) return false;
    if (state.gamePhase !== GamePhase.BENCH_SELECTION) {
      return false;
    }

    const playerState = state.getCurrentPlayerState();
    const benchCount = playerState.getBenchPieces().length;
    const currentBenchTypeCount = playerState
      .getBenchPieces()
      .filter((p) => p.type === type).length;

    if (benchCount >= GAME_RULES.PIECES_IN_BENCH) {
      return false;
    }

    const totalOfType = playerState.getSelectedPieceCount(type) + currentBenchTypeCount;
    if (totalOfType >= GAME_RULES.MAX_PIECES_PER_TYPE) {
      return false;
    }

    // Check if selecting this piece would prevent meeting MIN_PIECES_PER_TYPE for other types
    const remainingBenchSlots = GAME_RULES.PIECES_IN_BENCH - benchCount;

    // For each piece type, check if we can still meet the minimum requirement
    const allPieceTypes = Object.values(PieceType);
    for (const otherType of allPieceTypes) {
      if (otherType === type) continue;

      const otherTypeTotal =
        playerState.getSelectedPieceCount(otherType) +
        playerState.getBenchPieces().filter((p) => p.type === otherType).length;

      // If this other type is below minimum and we don't have enough slots to reach it
      if (otherTypeTotal < GAME_RULES.MIN_PIECES_PER_TYPE) {
        const neededToReachMin = GAME_RULES.MIN_PIECES_PER_TYPE - otherTypeTotal;
        const slotsAvailableForOthers = remainingBenchSlots - 1; // -1 for current selection

        if (slotsAvailableForOthers < neededToReachMin) {
          return false;
        }
      }
    }

    return true;
  },

  canPlaceBenchPiece: () => {
    const state = get();
    if (!state.isLocalPlayerTurn()) return false;
    if (state.gamePhase !== GamePhase.PLAYING) return false;

    const playerState = state.getCurrentPlayerState();
    const piecesOnBoard = state.board
      .getAllPieces()
      .filter((p) => p.owner === state.currentPlayer).length;
    const hasBenchPieces = playerState.getBenchPieces().length > 0;

    return piecesOnBoard < GAME_RULES.PIECES_TO_PLACE && hasBenchPieces;
  },

  selectPieceTypeForSetup: (type: PieceType) => {
    set((state) => {
      if (!state.canSelectPieceType(type)) return state;

      // Calculate valid placement positions for setup phase
      const validRows = (
        state.currentPlayer === Player.BLANCAS
          ? GAME_RULES.PLACEMENT_ROWS_PLAYER1
          : GAME_RULES.PLACEMENT_ROWS_PLAYER2
      ) as readonly number[];

      const validPositions: Position[] = [];

      for (const row of validRows) {
        for (let col = 0; col < GAME_CONFIG.BOARD_WIDTH; col++) {
          const pos = new Position(col, row);
          const existingPiece = state.board.getPieceAt(pos);

          if (!existingPiece) {
            const piecesInRow = state.board
              .getAllPieces()
              .filter(
                (p) => p.position && p.position.y === row && p.owner === state.currentPlayer,
              ).length;

            if (piecesInRow < GAME_RULES.MAX_PIECES_PER_ROW) {
              validPositions.push(pos);
            }
          }
        }
      }

      // Clear previous highlights and show new valid positions
      state.board.clearSelection();
      state.board.clearHighlights();
      state.board.highlightPositions(validPositions);

      return {
        selectedPieceTypeForPlacement: type,
        validMoves: validPositions,
        blockedMoves: [],
      };
    });
  },

  selectPieceTypeForBench: (type: PieceType) => {
    set((state) => {
      if (!state.canSelectBenchPieceType(type)) {
        return state;
      }

      const playerState = state.getCurrentPlayerState();
      const pieceId = `bench-${state.currentPlayer}-${state.pieceIdCounter}`;
      const benchPiece = new GamePiece(pieceId, type, null, state.currentPlayer);

      playerState.addBenchPiece(benchPiece);

      const benchCount = playerState.getBenchPieces().length;

      const newState: Partial<GameStateStore> = {
        pieceIdCounter: state.pieceIdCounter + 1,
      };

      if (benchCount >= GAME_RULES.PIECES_IN_BENCH) {
        if (state.currentPlayer === Player.BLANCAS) {
          newState.currentPlayer = Player.NEGRAS;
        } else {
          newState.gamePhase = GamePhase.PLAYING;
          newState.currentPlayer = Player.BLANCAS;
        }
      }

      return newState;
    });
  },

  placePieceInSetup: (position: Position) => {
    set((state) => {
      if (!state.isLocalPlayerTurn()) return state;
      if (state.gamePhase !== GamePhase.SETUP) return state;
      if (!state.selectedPieceTypeForPlacement) return state;

      const playerState = state.getCurrentPlayerState();
      const placedCount = playerState.getPlacedPiecesCount();

      if (placedCount >= GAME_RULES.PIECES_TO_PLACE) return state;

      const validRows = (
        state.currentPlayer === Player.BLANCAS
          ? GAME_RULES.PLACEMENT_ROWS_PLAYER1
          : GAME_RULES.PLACEMENT_ROWS_PLAYER2
      ) as readonly number[];

      if (!validRows.includes(position.y)) return state;

      if (state.board.getPieceAt(position)) return state;

      const piecesInRow = state.board
        .getAllPieces()
        .filter(
          (p) => p.position && p.position.y === position.y && p.owner === state.currentPlayer,
        ).length;

      if (piecesInRow >= GAME_RULES.MAX_PIECES_PER_ROW) return state;

      const pieceType = state.selectedPieceTypeForPlacement;
      const pieceId = `piece-${state.pieceIdCounter}`;
      const piece = new GamePiece(pieceId, pieceType, position, state.currentPlayer);

      state.board.addPiece(piece);
      playerState.addSelectedPiece(pieceType);
      playerState.addPlacedPiece(piece);

      // Clear highlights after placing piece
      state.board.clearSelection();
      state.board.clearHighlights();

      const p1Placed = state.player1State.getPlacedPiecesCount();
      const p2Placed = state.player2State.getPlacedPiecesCount();
      const totalPlaced = p1Placed + p2Placed;

      const newState: Partial<GameStateStore> = {
        pieceIdCounter: state.pieceIdCounter + 1,
        selectedPieceTypeForPlacement: null,
        validMoves: [],
        blockedMoves: [],
      };

      if (totalPlaced >= GAME_RULES.PIECES_TO_PLACE * 2) {
        newState.gamePhase = GamePhase.BENCH_SELECTION;
        newState.currentPlayer = Player.BLANCAS;
        // Clear highlights when moving to bench selection
        state.board.clearSelection();
        state.board.clearHighlights();
      } else {
        newState.currentPlayer =
          state.currentPlayer === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
        // Clear highlights when switching turns
        state.board.clearSelection();
        state.board.clearHighlights();
      }

      return newState;
    });
  },

  placeBenchPiece: (position: Position) => {
    set((state) => {
      if (!state.isLocalPlayerTurn()) return state;
      if (state.gamePhase !== GamePhase.PLAYING) return state;

      const playerState = state.getCurrentPlayerState();
      const benchPieces = playerState.getBenchPieces();

      if (benchPieces.length === 0) return state;

      const piecesOnBoard = state.board
        .getAllPieces()
        .filter((p) => p.owner === state.currentPlayer).length;
      if (piecesOnBoard >= GAME_RULES.PIECES_TO_PLACE) return state;

      const validRows = (
        state.currentPlayer === Player.BLANCAS
          ? GAME_RULES.PLACEMENT_ROWS_PLAYER1
          : GAME_RULES.PLACEMENT_ROWS_PLAYER2
      ) as readonly number[];

      if (!validRows.includes(position.y)) return state;

      if (state.board.getPieceAt(position)) return state;

      const piecesInRow = state.board
        .getAllPieces()
        .filter(
          (p) => p.position && p.position.y === position.y && p.owner === state.currentPlayer,
        ).length;

      if (piecesInRow >= GAME_RULES.MAX_PIECES_PER_ROW) return state;

      const benchPiece = state.selectedBenchPiece || benchPieces[0];
      if (!benchPiece) return state;
      benchPiece.moveTo(position);

      state.board.addPiece(benchPiece);
      playerState.removeBenchPiece(benchPiece.id);

      // Clear highlights and selection
      state.board.clearSelection();
      state.board.clearHighlights();

      return {
        selectedBenchPiece: null,
        validMoves: [],
        blockedMoves: [],
      };
    });
  },

  selectBenchPiece: (benchPiece: GamePiece) => {
    set((state) => {
      if (!state.isLocalPlayerTurn()) return state;
      if (state.gamePhase !== GamePhase.PLAYING) return state;

      const playerState = state.getCurrentPlayerState();
      const benchPieces = playerState.getBenchPieces();

      if (!benchPieces.includes(benchPiece)) return state;

      // Calculate valid placement positions
      const validRows = (
        state.currentPlayer === Player.BLANCAS
          ? GAME_RULES.PLACEMENT_ROWS_PLAYER1
          : GAME_RULES.PLACEMENT_ROWS_PLAYER2
      ) as readonly number[];

      const validPositions: Position[] = [];

      for (const row of validRows) {
        for (let col = 0; col < GAME_CONFIG.BOARD_WIDTH; col++) {
          const pos = new Position(col, row);
          const existingPiece = state.board.getPieceAt(pos);

          if (!existingPiece) {
            const piecesInRow = state.board
              .getAllPieces()
              .filter(
                (p) => p.position && p.position.y === row && p.owner === state.currentPlayer,
              ).length;

            if (piecesInRow < GAME_RULES.MAX_PIECES_PER_ROW) {
              validPositions.push(pos);
            }
          }
        }
      }

      state.board.clearSelection();
      state.board.clearHighlights();
      state.board.highlightPositions(validPositions);

      return {
        selectedBenchPiece: benchPiece,
        selectedPiece: null,
        validMoves: validPositions,
        blockedMoves: [],
      };
    });
  },

  selectTile: (position: Position) => {
    set((state) => {
      if (!state.isLocalPlayerTurn()) return state;
      if (state.gamePhase === GamePhase.SETUP) {
        state.placePieceInSetup(position);
        return {};
      }

      if (state.gamePhase === GamePhase.BENCH_SELECTION) {
        return state;
      }

      if (state.gamePhase !== GamePhase.PLAYING) return state;

      const clickedPiece = state.board.getPieceAt(position);

      // Handle bench piece placement
      if (state.selectedBenchPiece) {
        state.placeBenchPiece(position);
        return {};
      }

      if (state.selectedPiece) {
        const isValidMove = state.validMoves.some((pos) => pos.equals(position));
        if (isValidMove) {
          return state;
        }

        if (clickedPiece && clickedPiece.owner === state.currentPlayer) {
          state.board.clearSelection();
          state.board.selectTile(position);
          const validMoves = state.movementEngine.getValidMoves(clickedPiece, state.board);
          const blockedMoves = state.movementEngine.getBlockedMoves(clickedPiece, state.board);
          state.board.highlightPositions(validMoves);
          return {
            selectedPiece: clickedPiece,
            validMoves,
            blockedMoves,
          };
        }

        state.board.clearSelection();
        state.board.clearHighlights();
        return {
          selectedPiece: null,
          validMoves: [],
          blockedMoves: [],
        };
      }

      if (clickedPiece && clickedPiece.owner === state.currentPlayer) {
        state.board.selectTile(position);
        const validMoves = state.movementEngine.getValidMoves(clickedPiece, state.board);
        const blockedMoves = state.movementEngine.getBlockedMoves(clickedPiece, state.board);
        state.board.highlightPositions(validMoves);
        return {
          selectedPiece: clickedPiece,
          validMoves,
          blockedMoves,
        };
      }

      return state;
    });
  },

  handleTileClick: (position: Position) => {
    const state = get();
    if (state.isViewingHistory) return;
    if (!state.isLocalPlayerTurn()) return;
    if (state.gamePhase !== GamePhase.SETUP && state.gamePhase !== GamePhase.PLAYING) {
      return;
    }

    const clickedPiece = state.board.getPieceAt(position);

    // 1. PRIORITY: bench placement (free action)
    if (state.gamePhase === GamePhase.PLAYING && state.canPlaceBenchPiece() && !clickedPiece) {
      state.placeBenchPiece(position);
      return;
    }

    // 2. Confirmed move
    if (state.selectedPiece && state.validMoves.some((p) => p.equals(position))) {
      state.movePiece(position);
      return;
    }

    // 3. Selection / reselection / deselection / SETUP placement
    state.selectTile(position);
  },

  checkScoring: (piece: GamePiece) => {
    const state = get();
    const scoringRow =
      state.currentPlayer === Player.BLANCAS
        ? GAME_RULES.SCORING_ZONE_PLAYER1
        : GAME_RULES.SCORING_ZONE_PLAYER2;

    if (piece.position && piece.position.y === scoringRow) {
      const playerState = piece.owner === Player.BLANCAS ? state.player1State : state.player2State;
      playerState.incrementScore();
      state.board.removePiece(piece.id);

      set({});
      get().checkGameOver();
    }
  },

  checkGameOver: () => {
    const state = get();
    const p1Score = state.player1State.getScore();
    const p2Score = state.player2State.getScore();

    if (p1Score >= GAME_RULES.POINTS_TO_WIN || p2Score >= GAME_RULES.POINTS_TO_WIN) {
      set({ gamePhase: GamePhase.GAME_OVER });
      return;
    }

    const p1Pieces = state.board.getAllPieces().filter((p) => p.owner === Player.BLANCAS);
    const p2Pieces = state.board.getAllPieces().filter((p) => p.owner === Player.NEGRAS);

    const p1HasMoves = p1Pieces.some(
      (piece) => state.movementEngine.getValidMoves(piece, state.board).length > 0,
    );
    const p2HasMoves = p2Pieces.some(
      (piece) => state.movementEngine.getValidMoves(piece, state.board).length > 0,
    );

    if (!p1HasMoves && !p2HasMoves) {
      set({ gamePhase: GamePhase.GAME_OVER });
    }
  },

  movePiece: (to: Position) => {
    set((state) => {
      if (!state.isLocalPlayerTurn()) return state;
      if (state.gamePhase !== GamePhase.PLAYING) return state;
      if (!state.selectedPiece) return state;

      const isValidMove = state.validMoves.some((pos) => pos.equals(to));
      if (!isValidMove) return state;

      const fromPosition = new Position(
        state.selectedPiece.position!.x,
        state.selectedPiece.position!.y,
      );
      const capturedPiece = state.board.getPieceAt(to);

      // Execute the move first
      state.board.movePiece(state.selectedPiece.id, to);
      state.selectedPiece.moveTo(to);

      // Then save the snapshot AFTER the move
      const moveRecord: MoveRecord = {
        moveNumber: state.moveHistory.getTotalMoves() + 1,
        player: state.currentPlayer,
        pieceId: state.selectedPiece.id,
        pieceType: state.selectedPiece.type,
        from: fromPosition,
        to: new Position(to.x, to.y),
        captured: capturedPiece
          ? {
              pieceId: capturedPiece.id,
              pieceType: capturedPiece.type,
              position: new Position(to.x, to.y),
            }
          : undefined,
        boardSnapshot: JSON.stringify(
          state.board.getAllPieces().map((p) => ({
            id: p.id,
            type: p.type,
            owner: p.owner,
            position: p.position ? { x: p.position.x, y: p.position.y } : null,
          })),
        ),
        timestamp: new Date(),
      };

      state.moveHistory.addMove(moveRecord);

      state.checkScoring(state.selectedPiece);

      state.board.clearSelection();
      state.board.clearHighlights();

      const nextPlayer = state.currentPlayer === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;

      return {
        selectedPiece: null,
        validMoves: [],
        currentPlayer: nextPlayer,
        isViewingHistory: false,
      };
    });
  },

  startGame: () => {
    set({ gamePhase: GamePhase.SETUP, currentPlayer: Player.BLANCAS });
  },

  hoverTile: (position: Position | null) => {
    set((state) => {
      if (!position) return state;
      return state;
    });
  },

  reset: () => {
    const board = createInitialBoard();
    const player1State = new PlayerState("player1");
    const player2State = new PlayerState("player2");

    set({
      board,
      gamePhase: GamePhase.SETUP,
      gameMode: GameMode.PVP,
      currentPlayer: Player.BLANCAS,
      player1State,
      player2State,
      selectedPiece: null,
      selectedPieceTypeForPlacement: null,
      selectedBenchPiece: null,
      validMoves: [],
      blockedMoves: [],
      pieceIdCounter: 0,
      moveHistory: new MoveHistory(),
      isViewingHistory: false,
      localPlayer: null,
      roomId: null,
    });
  },

  quickStart: () => {
    if (get().gameMode === GameMode.ONLINE) return;
    const board = createInitialBoard();
    const player1State = new PlayerState("player1");
    const player2State = new PlayerState("player2");
    let pieceCounter = 0;

    // Player 1 pieces on board (rows 2-4)
    const p1BoardPieces = [
      { type: PieceType.BULWARK, pos: new Position(1, 1) },
      { type: PieceType.VANGUARD, pos: new Position(3, 1) },
      { type: PieceType.APEX, pos: new Position(2, 2) },
      { type: PieceType.BULWARK, pos: new Position(0, 3) },
      { type: PieceType.VANGUARD, pos: new Position(4, 3) },
    ];

    p1BoardPieces.forEach(({ type, pos }) => {
      const piece = new GamePiece(`p1-${pieceCounter++}`, type, pos, Player.BLANCAS);
      board.addPiece(piece);
      player1State.addSelectedPiece(type);
      player1State.addPlacedPiece(piece);
    });

    // Player 1 bench pieces
    const p1BenchPieces = [PieceType.VANGUARD, PieceType.APEX, PieceType.BULWARK];

    p1BenchPieces.forEach((type) => {
      const benchPiece = new GamePiece(`p1-bench-${pieceCounter++}`, type, null, Player.BLANCAS);
      player1State.addBenchPiece(benchPiece);
    });

    // Player 2 pieces on board (rows 8-10)
    const p2BoardPieces = [
      { type: PieceType.BULWARK, pos: new Position(1, 9) },
      { type: PieceType.VANGUARD, pos: new Position(3, 9) },
      { type: PieceType.APEX, pos: new Position(2, 8) },
      { type: PieceType.BULWARK, pos: new Position(0, 7) },
      { type: PieceType.VANGUARD, pos: new Position(4, 7) },
    ];

    p2BoardPieces.forEach(({ type, pos }) => {
      const piece = new GamePiece(`p2-${pieceCounter++}`, type, pos, Player.NEGRAS);
      board.addPiece(piece);
      player2State.addSelectedPiece(type);
      player2State.addPlacedPiece(piece);
    });

    // Player 2 bench pieces
    const p2BenchPieces = [PieceType.VANGUARD, PieceType.APEX, PieceType.BULWARK];

    p2BenchPieces.forEach((type) => {
      const benchPiece = new GamePiece(`p2-bench-${pieceCounter++}`, type, null, Player.NEGRAS);
      player2State.addBenchPiece(benchPiece);
    });

    set({
      board,
      gamePhase: GamePhase.PLAYING,
      currentPlayer: Player.BLANCAS,
      player1State,
      player2State,
      selectedPiece: null,
      selectedPieceTypeForPlacement: null,
      selectedBenchPiece: null,
      validMoves: [],
      blockedMoves: [],
      pieceIdCounter: pieceCounter,
      moveHistory: new MoveHistory(),
      isViewingHistory: false,
    });
  },

  setGameMode: (mode: GameMode) => {
    set({ gameMode: mode });
  },

  goBackInHistory: () => {
    const state = get();
    if (!state.moveHistory.canGoBack()) return;

    const previousMove = state.moveHistory.goBack();
    if (!previousMove) return;

    const newBoard = restoreBoardFromSnapshot(previousMove.boardSnapshot);

    set({
      board: newBoard,
      isViewingHistory: true,
      selectedPiece: null,
      validMoves: [],
      blockedMoves: [],
    });
  },

  goForwardInHistory: () => {
    const state = get();
    if (!state.moveHistory.canGoForward()) return;

    const nextMove = state.moveHistory.goForward();
    if (!nextMove) return;

    const newBoard = restoreBoardFromSnapshot(nextMove.boardSnapshot);

    const isAtPresent = !state.moveHistory.isViewingHistory();

    set({
      board: newBoard,
      isViewingHistory: !isAtPresent,
      selectedPiece: null,
      validMoves: [],
      blockedMoves: [],
    });
  },

  returnToPresent: () => {
    const state = get();

    while (state.moveHistory.canGoForward()) {
      state.moveHistory.goForward();
    }

    const currentMove = state.moveHistory.getCurrentMove();
    if (!currentMove) return;

    const newBoard = restoreBoardFromSnapshot(currentMove.boardSnapshot);

    set({
      board: newBoard,
      isViewingHistory: false,
      selectedPiece: null,
      validMoves: [],
      blockedMoves: [],
    });
  },

  getMoveHistory: () => {
    return get().moveHistory.getAllMoves();
  },

  canGoBack: () => {
    return get().moveHistory.canGoBack();
  },

  canGoForward: () => {
    return get().moveHistory.canGoForward();
  },
}));

export class GameState implements IGameState {
  getBoard(): Board {
    return useGameStore.getState().board;
  }

  selectTile(position: Position): void {
    useGameStore.getState().selectTile(position);
  }

  hoverTile(position: Position | null): void {
    useGameStore.getState().hoverTile(position);
  }

  reset(): void {
    useGameStore.getState().reset();
  }

  subscribe(callback: () => void): () => void {
    return useGameStore.subscribe(callback);
  }
}
