import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Dialog } from "@ferpa/ui";
import { PiecePickerDialog } from "./PiecePickerDialog";
import { useGameStore } from "../application/GameState";
import { GamePhase } from "../domain/constants/GameRules";
import { PieceType } from "../domain/constants/PieceConstants";
import { Position } from "../domain/entities/Position";

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("PiecePickerDialog", () => {
  it("opens in SETUP with the piece selector and its hint", () => {
    render(<PiecePickerDialog />);
    const dialog = screen.getByRole("dialog", { name: "Choose your piece" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText(/pick a piece type/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Bulwark/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Vanguard/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Apex/ })).toBeInTheDocument();
  });

  it("cannot be dismissed with Escape or a click on the overlay", () => {
    render(<PiecePickerDialog />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useGameStore.getState().selectedPieceTypeForPlacement).toBeNull();
  });

  it("traps focus inside the dialog", () => {
    render(<PiecePickerDialog />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    const buttons = within(dialog).getAllByRole("button");
    const first = buttons[0] as HTMLElement;
    const last = buttons[buttons.length - 1] as HTMLElement;

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("closes after choosing a type and reopens once the piece is placed", () => {
    render(<PiecePickerDialog />);
    fireEvent.click(screen.getByRole("button", { name: /Bulwark/ }));
    expect(useGameStore.getState().selectedPieceTypeForPlacement).toBe(PieceType.BULWARK);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      useGameStore.getState().handleTileClick(new Position(0, 1));
    });
    expect(useGameStore.getState().selectedPieceTypeForPlacement).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("stays open for all of BENCH_SELECTION", () => {
    act(() => {
      useGameStore.setState({ gamePhase: GamePhase.BENCH_SELECTION });
    });
    render(<PiecePickerDialog />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/choose 3 bench pieces/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("never opens during PLAYING or GAME_OVER", () => {
    act(() => {
      useGameStore.getState().quickStart();
    });
    render(<PiecePickerDialog />);
    expect(useGameStore.getState().gamePhase).toBe(GamePhase.PLAYING);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      useGameStore.setState({ gamePhase: GamePhase.GAME_OVER });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Dialog blocking prop", () => {
  it("blocking dialog ignores Escape and overlay clicks", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} blocking labelledBy="t">
        <h2 id="t">Title</h2>
        <button type="button">ok</button>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("non-blocking dialog still closes with Escape and overlay clicks", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} labelledBy="t">
        <h2 id="t">Title</h2>
        <button type="button">ok</button>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
