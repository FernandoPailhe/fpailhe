import { describe, expect, it } from "vitest";
import { createGameStore } from "./GameState";
import { Position } from "../domain/entities/Position";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GameMode, GamePhase, SetupTurnMode } from "../domain/constants/GameRules";
import { canPlaceFromBench, getBenchPlacementSquares } from "./rules/turnRules";
import {
  registerComputerPlayer,
  type BotPlayAction,
  type ComputerPlayer,
} from "./ai/ComputerPlayer";
import { createEasyBot } from "./ai/EasyBot";

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
    expect(S().botController).not.toBeNull();
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

  it("HIDDEN SETUP: el controller recibe un tablero sin piezas del rival; en PLAYING ya lo ve completo", () => {
    const sawOpponent: boolean[] = [];
    const real = createEasyBot(() => 0.5);
    const spy: ComputerPlayer = {
      difficulty: "easy",
      chooseSetupPlacement: (ctx) => {
        sawOpponent.push(ctx.board.getAllPieces().some((p) => p.owner !== ctx.bot));
        return real.chooseSetupPlacement(ctx);
      },
      chooseBenchType: (ctx) => real.chooseBenchType(ctx),
      choosePlayAction: (ctx) => {
        sawOpponent.push(ctx.board.getAllPieces().some((p) => p.owner !== ctx.bot));
        return real.choosePlayAction(ctx);
      },
    };
    registerComputerPlayer("easy", () => spy);
    try {
      const store = createGameStore();
      store.getState().startVsComputer(SetupTurnMode.HIDDEN);
      const S = () => store.getState();

      runHumanHiddenSetup(store);
      // Turno del bot en SETUP: el humano ya puso 5 piezas invisibles para él.
      S().runBotTurn(() => 0.5);
      expect(sawOpponent).toEqual([false]);

      drainBot(store);
      expect(S().gamePhase).toBe(GamePhase.PLAYING);
      expect(S().currentPlayer).toBe(Player.BLANCAS);
      expect(sawOpponent.every((v) => v === false)).toBe(true);

      // En PLAYING el tablero ya es completo: el bot ve al rival.
      S().handleTileClick(pos(0, 3));
      S().handleTileClick(pos(0, 4));
      S().runBotTurn(() => 0.31);
      expect(sawOpponent.at(-1)).toBe(true);
    } finally {
      registerComputerPlayer("easy", createEasyBot);
    }
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

describe("runBotTurnAsync", () => {
  const playingVsBot = () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.ALTERNATING);
    store.getState().quickStart("classic", "classic");
    store.getState().handleTileClick(pos(2, 2));
    store.getState().handleTileClick(pos(2, 4));
    return store;
  };

  const syncStubs = {
    difficulty: "easy" as const,
    chooseSetupPlacement: () => null,
    chooseBenchType: () => null,
    choosePlayAction: (): BotPlayAction => ({ kind: "pass" }),
  };

  it("sin métodos async cae a runBotTurn (Easy se comporta igual)", async () => {
    const store = playingVsBot();
    const S = () => store.getState();
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    const ok = await S().runBotTurnAsync(new AbortController().signal, () => 0.31);
    expect(ok).toBe(true);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().botThinking).toBe(false);
  });

  it("aplica [bench, move] en orden dentro de un solo turno", async () => {
    const store = playingVsBot();
    const S = () => store.getState();
    // La banca solo baja si hay menos de piecesToPlace piezas propias en juego.
    const victim = S()
      .board.getAllPieces()
      .find((p) => p.owner === Player.NEGRAS)!;
    S().board.removePiece(victim.id);
    const benchPiece = S().player2State.getBenchPieces()[0]!;
    const square = getBenchPlacementSquares(S().board, Player.NEGRAS)[0]!;
    let move: BotPlayAction = { kind: "pass" };
    for (const p of S().board.getAllPieces()) {
      if (p.owner !== Player.NEGRAS || !p.position) continue;
      const moves = S().movementEngine.getValidMoves(p, S().board);
      if (moves[0]) {
        move = { kind: "move", pieceId: p.id, to: moves[0] };
        break;
      }
    }
    const fake: ComputerPlayer = {
      ...syncStubs,
      choosePlayActionAsync: async () => [
        { kind: "bench", benchPieceId: benchPiece.id, to: square },
        move,
      ],
    };
    store.setState({ botController: fake });

    const ok = await S().runBotTurnAsync(new AbortController().signal);
    expect(ok).toBe(true);
    expect(S().board.getPieceAt(square)?.owner).toBe(Player.NEGRAS);
    expect(S().player2State.getBenchPieces()).toHaveLength(2);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });

  it("descarta la respuesta si el turno cambió mientras pensaba (token)", async () => {
    const store = playingVsBot();
    const S = () => store.getState();
    // Historial con ≥2 movimientos para habilitar goBackInHistory.
    S().runBotTurn(() => 0.31);
    S().handleTileClick(pos(3, 1));
    S().handleTileClick(pos(3, 2));
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    let resolveSearch!: (a: BotPlayAction[]) => void;
    const fake: ComputerPlayer = {
      ...syncStubs,
      choosePlayActionAsync: () =>
        new Promise((res) => {
          resolveSearch = res;
        }),
    };
    store.setState({ botController: fake });

    const p = S().runBotTurnAsync(new AbortController().signal);
    expect(S().botThinking).toBe(true);
    // La partida cambió antes de que llegara la respuesta.
    S().goBackInHistory();
    resolveSearch([{ kind: "pass" }]);
    expect(await p).toBe(false);
    expect(S().botThinking).toBe(false);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
  });

  it("señal abortada → false sin aplicar nada", async () => {
    const store = playingVsBot();
    const S = () => store.getState();
    const fake: ComputerPlayer = {
      ...syncStubs,
      choosePlayActionAsync: (_ctx, signal) =>
        new Promise((_, rej) => {
          signal.addEventListener("abort", () =>
            rej(Object.assign(new Error("x"), { name: "AbortError" })),
          );
        }),
    };
    store.setState({ botController: fake });
    const ctl = new AbortController();
    const p = S().runBotTurnAsync(ctl.signal);
    ctl.abort();
    expect(await p).toBe(false);
    expect(S().botThinking).toBe(false);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
  });
});
