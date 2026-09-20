import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TryMateBoard } from "./TryMateBoard";
import { useGameStore } from "../application/GameState";
import { Player } from "../domain/constants/PieceConstants";

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
    // quickStart places a White Pioneer on c3 (x=2, y=2)
    fireEvent.click(screen.getByRole("button", { name: "c3 — White Pioneer" }));
    expect(useGameStore.getState().selectedPiece).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /legal move/ }).length).toBeGreaterThan(0);
  });

  it("renders legal-move dots with a high-contrast halo (visible on dark tiles)", () => {
    useGameStore.getState().quickStart();
    render(<TryMateBoard />);
    fireEvent.click(screen.getByRole("button", { name: "c3 — White Pioneer" }));
    const moveTile = screen.getAllByRole("button", { name: /legal move/ })[0];
    const dot = moveTile?.querySelector("span");
    expect(dot?.className).toContain("bg-gold");
    expect(dot?.className).toContain("ring-pitch");
  });

  it("marks the try-zone rows (1 and 11) as the arrival, not the field", () => {
    useGameStore.getState().quickStart();
    render(<TryMateBoard />);
    const zoneTiles = screen.getAllByRole("button", { name: /try zone/ });
    expect(zoneTiles).toHaveLength(10);
    for (const tile of zoneTiles) {
      const cell = tile.parentElement as HTMLElement;
      const separator =
        cell.className.includes("border-b-gold") || cell.className.includes("border-t-gold");
      const fade = cell.className.includes("to-canvas");
      expect(separator && fade).toBe(true);
    }
  });

  it("keeps White at the bottom in local play", () => {
    useGameStore.getState().quickStart();
    render(<TryMateBoard />);
    const rows = screen.getAllByRole("row");
    // White Pioneer (2,2) en DOM row 9; Black Pioneer (2,8) en DOM row 3.
    expect(
      rows[8]!.querySelector('[data-square="2,2"]'),
    ).toBeInTheDocument();
    expect(
      rows[2]!.querySelector('[data-square="2,8"]'),
    ).toBeInTheDocument();
  });

  it("rotates the board 180° for the Black player online (issue #20)", () => {
    useGameStore.getState().quickStart();
    useGameStore.getState().setOnlineContext("room-1", Player.NEGRAS);
    render(<TryMateBoard />);
    const rows = screen.getAllByRole("row");
    // Rotado: y=0 arriba, y=10 abajo — las piezas del guest quedan abajo.
    expect(
      rows[8]!.querySelector('[data-square="2,8"]'),
    ).toBeInTheDocument();
    expect(
      rows[2]!.querySelector('[data-square="2,2"]'),
    ).toBeInTheDocument();
    // Columnas también invertidas: x=0 queda en la última celda visual.
    const rowCells = rows[8]!.querySelectorAll('[role="gridcell"]');
    expect(rowCells[4]!.querySelector('[data-square="0,8"]')).not.toBeNull();
    expect(rowCells[0]!.querySelector('[data-square="4,8"]')).not.toBeNull();
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
