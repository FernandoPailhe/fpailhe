import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TryMateBoard } from "./TryMateBoard";
import { useGameStore } from "../application/GameState";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { SetupTurnMode } from "../domain/constants/GameRules";
import { Position } from "../domain/entities/Position";

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

  it("renders legal-move dots with a halo that contrasts each tile tone (issues #15, #18)", () => {
    useGameStore.getState().quickStart();
    render(<TryMateBoard />);
    fireEvent.click(screen.getByRole("button", { name: "c3 — White Pioneer" }));
    const moveTiles = screen.getAllByRole("button", { name: /legal move/ });
    expect(moveTiles.length).toBeGreaterThan(0);
    for (const moveTile of moveTiles) {
      const [x, y] = moveTile.dataset.square!.split(",").map(Number);
      const lightTile = (x! + y!) % 2 === 1;
      const dot = moveTile.querySelector("span");
      expect(dot?.className).toContain("bg-gold");
      // Halo del tono opuesto: pitch-alt sobre casilla clara, pitch sobre oscura.
      expect(dot?.className).toContain(lightTile ? "ring-pitch-alt" : "ring-pitch");
    }
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
    expect(rows[8]!.querySelector('[data-square="2,2"]')).toBeInTheDocument();
    expect(rows[2]!.querySelector('[data-square="2,8"]')).toBeInTheDocument();
  });

  it("rotates the board 180° for the Black player online (issue #20)", () => {
    useGameStore.getState().quickStart();
    useGameStore.getState().setOnlineContext("room-1", Player.NEGRAS);
    render(<TryMateBoard />);
    const rows = screen.getAllByRole("row");
    // Rotado: y=0 arriba, y=10 abajo — las piezas del guest quedan abajo.
    expect(rows[8]!.querySelector('[data-square="2,8"]')).toBeInTheDocument();
    expect(rows[2]!.querySelector('[data-square="2,2"]')).toBeInTheDocument();
    // Columnas también invertidas: x=0 queda en la última celda visual.
    const rowCells = rows[8]!.querySelectorAll('[role="gridcell"]');
    expect(rowCells[4]!.querySelector('[data-square="0,8"]')).not.toBeNull();
    expect(rowCells[0]!.querySelector('[data-square="4,8"]')).not.toBeNull();
  });

  it("labels ranks on the visual right edge and files on the visual bottom edge", () => {
    useGameStore.getState().quickStart();
    render(<TryMateBoard />);
    const tile = (square: string) =>
      document.querySelector(`[data-square="${square}"]`) as HTMLElement;

    // Columna derecha (x=4): número de fila arriba a la derecha.
    const rank = tile("4,3").querySelector("span")!;
    expect(rank.textContent).toBe("4");
    expect(rank.className).toContain("top-");
    expect(rank.className).toContain("right-");

    // Fila inferior (y=0): letra de columna abajo a la izquierda.
    const file = tile("2,0").querySelector("span")!;
    expect(file.textContent).toBe("c");
    expect(file.className).toContain("bottom-");
    expect(file.className).toContain("left-");

    // Texto con el tono de la casilla contraria: e4 es pitch (claro) →
    // label pitch-alt; c1 es pitch-alt (oscuro) → label pitch.
    expect(rank.className).toContain("text-pitch-alt");
    expect(file.className).toContain("text-pitch");

    // Casillas interiores no llevan etiqueta.
    expect(tile("2,5").querySelector("span")).toBeNull();
    expect(tile("0,5").querySelector("span")).toBeNull();
  });

  it("keeps coordinates on the same visual edges when the board is flipped", () => {
    useGameStore.getState().quickStart();
    useGameStore.getState().setOnlineContext("room-1", Player.NEGRAS);
    render(<TryMateBoard />);
    const tile = (square: string) =>
      document.querySelector(`[data-square="${square}"]`) as HTMLElement;

    // Rotado: el borde derecho visual es x=0, el inferior es y=10.
    const rank = tile("0,5").querySelector("span")!;
    expect(rank.textContent).toBe("6");
    const file = tile("3,10").querySelector("span")!;
    expect(file.textContent).toBe("d");
    // Los bordes lógicos originales ya no llevan etiqueta.
    expect(tile("4,5").querySelector("span")).toBeNull();
    expect(tile("3,0").querySelector("span")).toBeNull();
  });

  it("masks opponent pieces during hidden setup", () => {
    const s = () => useGameStore.getState();
    s().reset(SetupTurnMode.HIDDEN);
    // BLANCAS coloca una pieza (en HIDDEN no alterna tras colocar).
    s().selectPieceTypeForSetup(PieceType.FORT);
    s().handleTileClick(new Position(0, 1));
    // Simula el turno de NEGRAS: configura sin ver lo de BLANCAS.
    useGameStore.setState({ currentPlayer: Player.NEGRAS });
    s().selectPieceTypeForSetup(PieceType.FORT);
    s().handleTileClick(new Position(0, 7));

    render(<TryMateBoard />);
    // La pieza de BLANCAS queda enmascarada: la casilla figura vacía.
    expect(screen.queryByRole("button", { name: /White/ })).toBeNull();
    expect(screen.getByRole("button", { name: "a2 — empty" })).toBeInTheDocument();
    // La propia pieza de NEGRAS sí se ve.
    expect(screen.getByRole("button", { name: "a8 — Black Fort" })).toBeInTheDocument();
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
