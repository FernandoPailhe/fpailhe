import { describe, expect, it } from "vitest";
import { createGameStore } from "./GameState";
import { Position } from "../domain/entities/Position";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GameMode, GamePhase, SetupTurnMode } from "../domain/constants/GameRules";
import { canPlaceFromBench, getBenchPlacementSquares } from "./rules/turnRules";

const pos = (x: number, y: number) => new Position(x, y);

const TYPES = [
  PieceType.FORT,
  PieceType.STRIKER,
  PieceType.PIONEER,
  PieceType.FORT,
  PieceType.STRIKER,
];
const WHITE_SPOTS = [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2), pos(0, 3)];
const BENCH_TYPES = [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER];

type Store = ReturnType<typeof createGameStore>;

/** Setup ALTERNATING completo: humano coloca, bot responde vía runBotTurn. */
const runAlternatingSetup = (store: Store) => {
  const S = () => store.getState();
  for (let i = 0; i < 5; i++) {
    S().selectPieceTypeForSetup(TYPES[i]!);
    S().handleTileClick(WHITE_SPOTS[i]!);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().runBotTurn(() => 0.5)).toBe(true);
  }
  expect(S().gamePhase).toBe(GamePhase.BENCH_SELECTION);
};

/** Setup HIDDEN completo del humano (5 piezas + 3 banca) sin alternar. */
const runHumanHiddenSetup = (store: Store) => {
  const S = () => store.getState();
  for (let i = 0; i < 5; i++) {
    S().selectPieceTypeForSetup(TYPES[i]!);
    S().handleTileClick(WHITE_SPOTS[i]!);
  }
  BENCH_TYPES.forEach((t) => S().selectPieceTypeForBench(t));
};

/** Deja al bot actuar hasta que cambie la fase o se agoten las acciones. */
const drainBot = (store: Store, max = 30) => {
  const S = () => store.getState();
  let steps = 0;
  while (S().currentPlayer === Player.NEGRAS && S().gamePhase !== GamePhase.GAME_OVER) {
    if (steps++ >= max || !S().runBotTurn(() => 0.5)) break;
  }
};

describe("runBotTurn — setup", () => {
  it("ALTERNATING: el bot coloca 5 piezas en filas 7–9 y elige su banca", () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.ALTERNATING);
    const S = () => store.getState();

    runAlternatingSetup(store);
    expect(S().player2State.getPlacedPiecesCount()).toBe(5);
    const blackOnBoard = S()
      .board.getAllPieces()
      .filter((p) => p.owner === Player.NEGRAS);
    expect(blackOnBoard.every((p) => p.position && p.position.y >= 7)).toBe(true);

    // Banca: el humano elige las suyas, el bot las 3 del layout.
    BENCH_TYPES.forEach((t) => S().selectPieceTypeForBench(t));
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    drainBot(store);
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().player2State.getBenchPieces()).toHaveLength(3);
    expect(S().botLayoutId).not.toBeNull();
  });

  it("HIDDEN: el bot completa sus 5+3 encadenadas tras el setup humano", () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.HIDDEN);
    const S = () => store.getState();

    runHumanHiddenSetup(store);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().setupCompleted).toEqual({ player1: true, player2: false });

    drainBot(store);
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().setupCompleted).toEqual({ player1: true, player2: true });
    expect(S().player2State.getPlacedPiecesCount()).toBe(5);
    expect(S().player2State.getBenchPieces()).toHaveLength(3);
  });
});

describe("runBotTurn — playing", () => {
  const playingVsBot = () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.ALTERNATING);
    store.getState().quickStart("classic", "classic");
    return store;
  };

  it("tras el movimiento humano el bot mueve y el turno vuelve", () => {
    const store = playingVsBot();
    const S = () => store.getState();

    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(2, 4));
    expect(S().currentPlayer).toBe(Player.NEGRAS);

    expect(S().runBotTurn(() => 0.31)).toBe(true);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().moveHistory.getTotalMoves()).toBe(2);
    expect(S().moveHistory.getCurrentMove()?.player).toBe(Player.NEGRAS);
  });

  it("devuelve false en PVP, en turno humano y navegando el historial", () => {
    const pvp = createGameStore();
    expect(pvp.getState().runBotTurn()).toBe(false);

    const store = playingVsBot();
    const S = () => store.getState();
    expect(S().gameMode).toBe(GameMode.VS_COMPUTER);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().runBotTurn()).toBe(false); // turno del humano

    // Dos movimientos para habilitar navegación de historial.
    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(2, 4));
    S().runBotTurn(() => 0.31);
    S().handleTileClick(pos(3, 1)); // striker blanco
    S().handleTileClick(pos(3, 2));
    expect(S().currentPlayer).toBe(Player.NEGRAS);

    S().goBackInHistory();
    expect(S().isViewingHistory).toBe(true);
    expect(S().runBotTurn()).toBe(false);

    S().returnToPresent();
    expect(S().runBotTurn(() => 0.31)).toBe(true);
  });
});

describe("partida simulada humano vs bot", () => {
  it("termina en GAME_OVER sin excepciones (≤ 400 acciones)", () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.ALTERNATING);
    store.getState().quickStart("classic", "vanguard");
    const S = () => store.getState();

    // rng sembrado para el bot; el humano juega la primera acción disponible.
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    const humanAct = (): void => {
      const s = S();
      const ps = s.player1State;
      const squares = getBenchPlacementSquares(s.board, Player.BLANCAS);
      if (canPlaceFromBench(s.board, Player.BLANCAS, ps) && squares.length > 0) {
        const piece = ps.getBenchPieces()[0]!;
        s.selectBenchPiece(piece);
        S().placeBenchPiece(squares[0]!);
        return;
      }
      for (const piece of s.board.getAllPieces()) {
        if (piece.owner !== Player.BLANCAS || !piece.position) continue;
        const moves = s.movementEngine.getValidMoves(piece, s.board);
        if (moves.length > 0) {
          s.selectTile(piece.position);
          S().movePiece(moves[0]!);
          return;
        }
      }
      s.resolveStalledTurn();
    };

    let steps = 0;
    while (S().gamePhase === GamePhase.PLAYING && steps++ < 400) {
      if (S().currentPlayer === Player.NEGRAS) {
        expect(S().runBotTurn(rng)).toBe(true);
      } else {
        humanAct();
      }
    }
    expect(S().gamePhase).toBe(GamePhase.GAME_OVER);
  });
});
