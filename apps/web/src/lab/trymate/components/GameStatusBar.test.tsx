import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useGameStore } from "../application/GameState";
import { Player } from "../domain/constants/PieceConstants";
import { GameMode, GamePhase, SetupTurnMode } from "../domain/constants/GameRules";
import { GameStatusBar } from "./GameStatusBar";

const vsComputerBotTurn = (over: Partial<ReturnType<typeof useGameStore.getState>> = {}) => {
  useGameStore.getState().startVsComputer(SetupTurnMode.ALTERNATING, "easy");
  useGameStore.setState({
    gameMode: GameMode.VS_COMPUTER,
    localPlayer: Player.BLANCAS,
    currentPlayer: Player.NEGRAS, // turno del bot
    gamePhase: GamePhase.PLAYING,
    botLoading: false,
    botThinking: false,
    ...over,
  });
};

describe("GameStatusBar — estados del bot", () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it("turno del humano → 'Your turn'", () => {
    vsComputerBotTurn({ currentPlayer: Player.BLANCAS });
    render(<GameStatusBar />);
    expect(screen.getByText("Your turn")).toBeInTheDocument();
  });

  it("bot cargando → 'Loading computer…'", () => {
    vsComputerBotTurn({ botLoading: true });
    render(<GameStatusBar />);
    expect(screen.getByText("Loading computer…")).toBeInTheDocument();
  });

  it("bot pensando → 'Computer is thinking…'", () => {
    vsComputerBotTurn({ botThinking: true });
    render(<GameStatusBar />);
    expect(screen.getByText("Computer is thinking…")).toBeInTheDocument();
  });

  it("badge muestra dificultad y personalidad solo en Hard", () => {
    vsComputerBotTurn({ botDifficulty: "medium" });
    const { unmount } = render(<GameStatusBar />);
    expect(screen.getByText("Computer · Medium")).toBeInTheDocument();
    unmount();

    vsComputerBotTurn({ botDifficulty: "hard", botPersonality: "offensive" });
    render(<GameStatusBar />);
    expect(screen.getByText("Computer · Hard · Offensive")).toBeInTheDocument();
  });
});
