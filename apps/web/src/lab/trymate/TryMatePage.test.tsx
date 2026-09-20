import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TryMatePage } from "./TryMatePage";
import { useGameStore } from "./application/GameState";
import { useRoomStore } from "./application/RoomState";
import { Player } from "./domain/constants/PieceConstants";

beforeEach(() => {
  useGameStore.getState().reset();
  useRoomStore.setState({
    status: "idle",
    roomId: null,
    role: null,
    rooms: [],
    error: null,
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TryMatePage />
    </MemoryRouter>,
  );
}

describe("TryMatePage", () => {
  it("shows no piece picker on the menu", () => {
    renderPage();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not flash the piece picker when entering the online lobby (issue #14)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still opens the setup picker for local play", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play local/i }));
    expect(screen.getByRole("dialog", { name: "Choose your piece" })).toBeInTheDocument();
  });

  it("opens the picker online only when connected and it is the local turn", () => {
    useGameStore.getState().setOnlineContext("room-1", Player.BLANCAS);
    useRoomStore.setState({ status: "connected", roomId: "room-1", role: "host" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));
    expect(screen.getByRole("dialog", { name: "Choose your piece" })).toBeInTheDocument();
  });

  it("keeps the picker closed online when it is the opponent's turn", () => {
    useGameStore.getState().setOnlineContext("room-1", Player.NEGRAS);
    useRoomStore.setState({ status: "connected", roomId: "room-1", role: "guest" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
