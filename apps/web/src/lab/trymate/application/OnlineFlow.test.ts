import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./GameState";
import { useRoomStore } from "./RoomState";
import { stopRoomSync } from "./roomSync";
import { InMemoryRoomsGateway } from "../infrastructure/InMemoryRoomsGateway";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GamePhase } from "../domain/constants/GameRules";
import { Position } from "../domain/entities/Position";
import type { GameSnapshot } from "../domain/entities/GameSnapshot";

const G = () => useGameStore.getState();
const R = () => useRoomStore.getState();
const pos = (x: number, y: number) => new Position(x, y);

let gateway: InMemoryRoomsGateway;

beforeEach(async () => {
  await useRoomStore.getState().leaveRoom();
  stopRoomSync();
  useGameStore.getState().reset();
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

/**
 * Simula el otro cliente: resetea el store, fija el contexto online del rol
 * dado y aplica el último snapshot publicado en la sala.
 */
function becomeClient(roomId: string, player: Player): void {
  stopRoomSync();
  const remote = gateway.getRoom(roomId)?.state as GameSnapshot;
  G().reset();
  G().setOnlineContext(roomId, player);
  if (remote) G().applyRemoteSnapshot(remote);
}

describe("online quick-start flow (issue #17/#19 repro)", () => {
  it("host can move after guest joins a quick-start room", async () => {
    // Host: quickStart + createRoom (orden de RoomLobby)
    G().quickStart();
    await R().createRoom();
    const roomId = R().roomId!;

    // Guest externo se une → host pasa a connected
    await gateway.joinRoom(roomId);
    expect(R().status).toBe("connected");
    expect(G().gamePhase).toBe(GamePhase.PLAYING);
    expect(G().isLocalPlayerTurn()).toBe(true);

    // Host selecciona y mueve
    G().handleTileClick(pos(2, 2));
    expect(G().selectedPiece).not.toBeNull();
    G().handleTileClick(pos(2, 4));
    expect(G().currentPlayer).toBe(Player.NEGRAS);
  });

  it("guest can move after receiving host's move (quick-start)", async () => {
    G().quickStart();
    await R().createRoom();
    const roomId = R().roomId!;
    await gateway.joinRoom(roomId);

    // Host mueve
    G().handleTileClick(pos(2, 2));
    G().handleTileClick(pos(2, 4));

    // === GUEST ===
    becomeClient(roomId, Player.NEGRAS);
    expect(G().gamePhase).toBe(GamePhase.PLAYING);
    expect(G().currentPlayer).toBe(Player.NEGRAS);
    expect(G().isLocalPlayerTurn()).toBe(true);
    G().handleTileClick(pos(2, 8)); // black pioneer
    expect(G().selectedPiece).not.toBeNull();
    G().handleTileClick(pos(2, 6));
    expect(G().currentPlayer).toBe(Player.BLANCAS);
  });

  it("full setup flow online: host and guest alternate until PLAYING", async () => {
    await R().createRoom();
    const roomId = R().roomId!;
    await gateway.joinRoom(roomId); // guest externo entra

    // Host (BLANCAS) coloca pieza 1
    expect(G().isLocalPlayerTurn()).toBe(true);
    G().selectPieceTypeForSetup(PieceType.FORT);
    G().handleTileClick(pos(0, 1));
    expect(G().currentPlayer).toBe(Player.NEGRAS);

    // === GUEST (NEGRAS) ===
    becomeClient(roomId, Player.NEGRAS);
    expect(G().isLocalPlayerTurn()).toBe(true);
    G().selectPieceTypeForSetup(PieceType.FORT);
    G().handleTileClick(pos(0, 9));
    expect(G().currentPlayer).toBe(Player.BLANCAS);
  });
});
