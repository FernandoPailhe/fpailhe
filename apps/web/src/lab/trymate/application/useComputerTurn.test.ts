import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGameStore } from "./GameState";
import { BOT_DELAY_MS, useComputerTurn } from "./useComputerTurn";
import { GamePhase, SetupTurnMode } from "../domain/constants/GameRules";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { Position } from "../domain/entities/Position";

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
  it("dispara runBotTurn tras la demora de PLAYING", () => {
    setupBotTurnInPlaying();
    renderHook(() => useComputerTurn());

    const movesBefore = S().moveHistory.getTotalMoves();
    act(() => {
      vi.advanceTimersByTime(BOT_DELAY_MS.playing);
    });

    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().moveHistory.getTotalMoves()).toBe(movesBefore + 1);
  });

  it("usa la demora corta durante SETUP y re-agenda en la misma fase", () => {
    S().startVsComputer(SetupTurnMode.ALTERNATING);
    S().selectPieceTypeForSetup(PieceType.FORT);
    S().handleTileClick(pos(0, 1));
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().gamePhase).toBe(GamePhase.SETUP);

    renderHook(() => useComputerTurn());
    act(() => {
      vi.advanceTimersByTime(BOT_DELAY_MS.setup);
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

  it("espera mientras se navega el historial y actúa al volver al presente", () => {
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
    act(() => {
      vi.advanceTimersByTime(BOT_DELAY_MS.playing);
    });
    expect(S().moveHistory.getTotalMoves()).toBe(movesBefore + 1);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
  });
});
