import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TryMateBoard } from "./TryMateBoard";
import { useGameStore } from "../application/GameState";

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("TryMateBoard", () => {
  it("renders the 55 grid cells", () => {
    useGameStore.getState().quickStart();
    render(<TryMateBoard />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(55);
  });

  it("selects an own piece and marks its legal moves", () => {
    useGameStore.getState().quickStart();
    render(<TryMateBoard />);
    // quickStart places a White Apex on c3 (x=2, y=2)
    fireEvent.click(screen.getByRole("button", { name: "c3 — White Apex" }));
    expect(useGameStore.getState().selectedPiece).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /legal move/ }).length).toBeGreaterThan(0);
  });

  it("locks the board while viewing history", () => {
    useGameStore.getState().quickStart();
    useGameStore.setState({ isViewingHistory: true });
    render(<TryMateBoard />);
    expect(screen.getByRole("grid")).toHaveAttribute("aria-disabled", "true");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
