import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BenchPieceDialog } from "./BenchPieceDialog";
import { useGameStore } from "../application/GameState";
import { Player } from "../domain/constants/PieceConstants";
import { Position } from "../domain/entities/Position";

const G = () => useGameStore.getState();

/** PLAYING con banca llena pero una pieza menos en el tablero → debe colocar. */
const stateWithBenchToPlace = () => {
  G().quickStart("classic", "classic");
  const piece = G().board.getPieceAt(new Position(0, 3));
  if (!piece) throw new Error("quickStart board changed");
  G().board.removePiece(piece.id);
  useGameStore.setState({}); // el board muta in-place: notificar
};

beforeEach(() => {
  G().reset();
});

describe("BenchPieceDialog (issue #21)", () => {
  it("opens as a blocking modal when the player must place a bench piece", () => {
    stateWithBenchToPlace();
    render(<BenchPieceDialog />);
    expect(screen.getByRole("dialog", { name: "Place a bench piece" })).toBeInTheDocument();
    // Lista las 3 piezas de la banca del jugador actual.
    expect(screen.getAllByRole("button", { name: /place bench/i })).toHaveLength(3);
  });

  it("closes after choosing a piece and marks valid squares", () => {
    stateWithBenchToPlace();
    render(<BenchPieceDialog />);
    fireEvent.click(screen.getAllByRole("button", { name: /place bench/i })[0]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(G().selectedBenchPiece).not.toBeNull();
    expect(G().validMoves.length).toBeGreaterThan(0);
  });

  it("stays closed while the bench cannot be placed (full board)", () => {
    G().quickStart(); // 5 piezas en tablero → nada que colocar
    render(<BenchPieceDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed online when it is the opponent's turn", () => {
    stateWithBenchToPlace();
    G().setOnlineContext("room-1", Player.NEGRAS); // BLANCAS tiene el turno
    render(<BenchPieceDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
