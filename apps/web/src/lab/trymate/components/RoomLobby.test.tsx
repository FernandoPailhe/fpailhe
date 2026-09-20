import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RoomLobby } from "./RoomLobby";
import { useGameStore } from "../application/GameState";
import { useRoomStore } from "../application/RoomState";
import { stopRoomSync } from "../application/roomSync";
import { clearHostCredential, saveHostCredential } from "../application/hostCredential";
import { InMemoryRoomsGateway } from "../infrastructure/InMemoryRoomsGateway";
import { GamePhase } from "../domain/constants/GameRules";
import { Player } from "../domain/constants/PieceConstants";

let gateway: InMemoryRoomsGateway;

beforeEach(async () => {
  await useRoomStore.getState().leaveRoom();
  stopRoomSync();
  useGameStore.getState().reset();
  clearHostCredential();
  gateway = new InMemoryRoomsGateway();
  useRoomStore.setState({
    gateway,
    status: "idle",
    roomId: null,
    role: null,
    rooms: [],
    error: null,
  });
});

function renderLobby(initialEntry = "/lab/trymate") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RoomLobby />
    </MemoryRouter>,
  );
}

describe("RoomLobby", () => {
  it("crea una sala manual por defecto: snapshot SETUP vacío", async () => {
    renderLobby();
    fireEvent.click(screen.getByRole("button", { name: /create a room/i }));
    await screen.findByText(/waiting for an opponent/i);
    const room = gateway.getRoom(useRoomStore.getState().roomId!);
    expect(room?.state?.gamePhase).toBe(GamePhase.SETUP);
    expect(room?.state?.board ?? []).toHaveLength(0);
  });

  it("con quick start crea la sala directamente en PLAYING", async () => {
    renderLobby();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /create a room/i }));
    await screen.findByText(/waiting for an opponent/i);
    const room = gateway.getRoom(useRoomStore.getState().roomId!);
    expect(room?.state?.gamePhase).toBe(GamePhase.PLAYING);
    expect(room?.state?.board).toHaveLength(10);
  });

  it("?room=<id> sin credencial entra como guest y aplica el snapshot remoto", async () => {
    useGameStore.getState().prepareOnlineGame("quick");
    const { roomId } = await gateway.createRoom(useGameStore.getState().toSnapshot());
    useGameStore.getState().reset();

    renderLobby(`/lab/trymate?room=${roomId}`);
    await screen.findByText(/you play/i);

    expect(useRoomStore.getState().role).toBe("guest");
    expect(useGameStore.getState().localPlayer).toBe(Player.NEGRAS);
    expect(useGameStore.getState().gamePhase).toBe(GamePhase.PLAYING);
  });

  it("?room=<id> con credencial de host reanuda el rol tras desconexión", async () => {
    const { roomId, hostToken } = await gateway.createRoom(useGameStore.getState().toSnapshot());
    saveHostCredential({ roomId, hostToken });
    await gateway.disconnectHost(roomId);

    renderLobby(`/lab/trymate?room=${roomId}`);
    await screen.findByText(/waiting for an opponent|you play/i);

    expect(useRoomStore.getState().role).toBe("host");
    expect(useRoomStore.getState().roomId).toBe(roomId);
    expect(useGameStore.getState().localPlayer).toBe(Player.BLANCAS);
    expect(gateway.getRoom(roomId)?.hostConnection).toBe("connected");
  });

  it("el link compartido no contiene el token del host", async () => {
    renderLobby();
    fireEvent.click(screen.getByRole("button", { name: /create a room/i }));
    await screen.findByText(/waiting for an opponent/i);
    const input = screen.getByLabelText("Room link") as HTMLInputElement;
    const { hostToken } = gateway.getRoom(useRoomStore.getState().roomId!)!;
    expect(input.value).toContain(`room=${useRoomStore.getState().roomId}`);
    expect(input.value).not.toContain(hostToken);
  });
});
