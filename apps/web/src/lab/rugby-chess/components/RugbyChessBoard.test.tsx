import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RugbyChessBoard } from "./RugbyChessBoard";
import { useGameStore } from "../application/GameState";

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("RugbyChessBoard", () => {
  it("renders the 55 grid cells", () => {
    useGameStore.getState().quickStart();
    render(<RugbyChessBoard />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(55);
  });

  it("selects an own piece and marks its legal moves", () => {
    useGameStore.getState().quickStart();
    render(<RugbyChessBoard />);
    // quickStart places a White Apex on c3 (x=2, y=2)
    fireEvent.click(screen.getByRole("button", { name: "c3 — White Apex" }));
    expect(useGameStore.getState().selectedPiece).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /legal move/ }).length).toBeGreaterThan(0);
  });

  it("locks the board while viewing history", () => {
    useGameStore.getState().quickStart();
    useGameStore.setState({ isViewingHistory: true });
    render(<RugbyChessBoard />);
    expect(screen.getByRole("grid")).toHaveAttribute("aria-disabled", "true");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
