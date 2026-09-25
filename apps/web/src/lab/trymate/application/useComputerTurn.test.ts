import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGameStore } from "./GameState";
import { BOT_DELAY_MS, useComputerTurn } from "./useComputerTurn";
import { GamePhase, SetupTurnMode } from "../domain/constants/GameRules";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { Position } from "../domain/entities/Position";
import type { BotPlayAction, ComputerPlayer } from "./ai/ComputerPlayer";

const pos = (x: number, y: number) => new Position(x, y);
const S = () => useGameStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useGameStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** VS_COMPUTER en PLAYING con el turno ya en el bot. */
const setupBotTurnInPlaying = () => {
  S().startVsComputer(SetupTurnMode.ALTERNATING);
  S().quickStart("classic", "classic");
  S().handleTileClick(pos(2, 2));
  S().handleTileClick(pos(2, 4));
  expect(S().currentPlayer).toBe(Player.NEGRAS);
};

describe("useComputerTurn", () => {
  it("dispara runBotTurn tras la demora de PLAYING", async () => {
    setupBotTurnInPlaying();
    renderHook(() => useComputerTurn());

    const movesBefore = S().moveHistory.getTotalMoves();
    await act(async () => {
      vi.advanceTimersByTime(BOT_DELAY_MS.playing);
      await Promise.resolve();
    });

    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().moveHistory.getTotalMoves()).toBe(movesBefore + 1);
  });

  it("usa la demora corta durante SETUP y re-agenda en la misma fase", async () => {
    S().startVsComputer(SetupTurnMode.ALTERNATING);
    S().selectPieceTypeForSetup(PieceType.FORT);
    S().handleTileClick(pos(0, 1));
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().gamePhase).toBe(GamePhase.SETUP);

    renderHook(() => useComputerTurn());
    await act(async () => {
      vi.advanceTimersByTime(BOT_DELAY_MS.setup);
      await Promise.resolve();
    });

    // El bot colocó una pieza; el turno vuelve al humano (ALTERNATING).
    expect(
      S()
        .board.getAllPieces()
        .filter((p) => p.owner === Player.NEGRAS),
    ).toHaveLength(1);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });

  it("no actúa en PVP", () => {
    const spy = vi.spyOn(useGameStore.getState(), "runBotTurn");
    renderHook(() => useComputerTurn());
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("espera mientras se navega el historial y actúa al volver al presente", async () => {
    setupBotTurnInPlaying();
    // Un movimiento más para habilitar goBackInHistory (necesita index > 0).
    S().runBotTurn(() => 0.31);
    S().handleTileClick(pos(3, 1));
    S().handleTileClick(pos(3, 2));
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    const movesBefore = S().moveHistory.getTotalMoves();

    renderHook(() => useComputerTurn());
    act(() => {
      S().goBackInHistory();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(S().moveHistory.getTotalMoves()).toBe(movesBefore);
    expect(S().currentPlayer).toBe(Player.NEGRAS);

    act(() => {
      S().returnToPresent();
    });
    await act(async () => {
      vi.advanceTimersByTime(BOT_DELAY_MS.playing);
      await Promise.resolve();
    });
    expect(S().moveHistory.getTotalMoves()).toBe(movesBefore + 1);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });
});

/** Bot async falso: resuelve su jugada cuando el test lo decide. */
const makeAsyncFakeBot = () => {
  let resolveSearch: ((a: BotPlayAction[]) => void) | null = null;
  let rejectSearch: ((e: unknown) => void) | null = null;
  let seenSignal: AbortSignal | null = null;
  const controller: ComputerPlayer = {
    difficulty: "easy",
    chooseSetupPlacement: () => null,
    chooseBenchType: () => null,
    choosePlayAction: () => ({ kind: "pass" }),
    choosePlayActionAsync: (_ctx, signal) => {
      seenSignal = signal;
      return new Promise((res, rej) => {
        resolveSearch = res;
        rejectSearch = rej;
      });
    },
  };
  return {
    controller,
    resolve: (a: BotPlayAction[]) => resolveSearch?.(a),
    reject: (e: unknown) => rejectSearch?.(e),
    seenSignal: () => seenSignal,
  };
};

/** Primera jugada legal de NEGRAS en el estado actual (o pase). */
const pickLegalMove = (): BotPlayAction => {
  const s = S();
  for (const p of s.board.getAllPieces()) {
    if (p.owner !== Player.NEGRAS || !p.position) continue;
    const moves = s.movementEngine.getValidMoves(p, s.board);
    if (moves[0]) return { kind: "move", pieceId: p.id, to: moves[0] };
  }
  return { kind: "pass" };
};

describe("useComputerTurn — bot async", () => {
  it("aplica las acciones del bot async; botThinking sube y baja", async () => {
    setupBotTurnInPlaying();
    const fake = makeAsyncFakeBot();
    useGameStore.setState({ botController: fake.controller });
    renderHook(() => useComputerTurn());

    act(() => {
      vi.advanceTimersByTime(BOT_DELAY_MS.playing);
    });
    expect(S().botThinking).toBe(true);

    await act(async () => {
      fake.resolve([pickLegalMove()]);
      await Promise.resolve();
    });
    expect(S().botThinking).toBe(false);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });

  it("descarta la respuesta si se entró al historial mientras pensaba", async () => {
    setupBotTurnInPlaying();
    // Dos jugadas más para habilitar la navegación del historial.
    S().runBotTurn(() => 0.31);
    S().handleTileClick(pos(3, 1));
    S().handleTileClick(pos(3, 2));
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    const movesBefore = S().moveHistory.getTotalMoves();

    const fake = makeAsyncFakeBot();
    useGameStore.setState({ botController: fake.controller });
    renderHook(() => useComputerTurn());
    act(() => {
      vi.advanceTimersByTime(BOT_DELAY_MS.playing);
    });
    expect(S().botThinking).toBe(true);

    act(() => {
      S().goBackInHistory();
    });
    await act(async () => {
      fake.resolve([pickLegalMove()]);
      await Promise.resolve();
    });

    // Descartada: el turno no avanzó ni se agregó jugada al historial.
    expect(S().botThinking).toBe(false);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().moveHistory.getTotalMoves()).toBe(movesBefore);
  });

  it("desmontar el hook aborta la búsqueda en curso", async () => {
    setupBotTurnInPlaying();
    const fake = makeAsyncFakeBot();
    useGameStore.setState({ botController: fake.controller });
    const { unmount } = renderHook(() => useComputerTurn());

    act(() => {
      vi.advanceTimersByTime(BOT_DELAY_MS.playing);
    });
    expect(fake.seenSignal()).not.toBeNull();
    expect(fake.seenSignal()!.aborted).toBe(false);

    unmount();
    expect(fake.seenSignal()!.aborted).toBe(true);
    await act(async () => {
      fake.resolve([pickLegalMove()]);
      await Promise.resolve();
    });
    expect(S().botThinking).toBe(false);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
  });
});
