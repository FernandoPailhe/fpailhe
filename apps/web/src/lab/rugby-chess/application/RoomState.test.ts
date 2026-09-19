import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "./GameState";
import { useRoomStore } from "./RoomState";
import { stopRoomSync } from "./roomSync";
import { InMemoryRoomsGateway } from "../infrastructure/InMemoryRoomsGateway";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GameMode } from "../domain/constants/GameRules";
import { Position } from "../domain/entities/Position";

const G = () => useGameStore.getState();
const R = () => useRoomStore.getState();

let gateway: InMemoryRoomsGateway;

beforeEach(async () => {
  // leaveRoom es idempotente: corta roomSync + watcher de status y resetea.
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

describe("useRoomStore", () => {
  it("createRoom → waiting + host + ONLINE context (BLANCAS)", async () => {
    await R().createRoom();
    expect(R().status).toBe("waiting");
    expect(R().role).toBe("host");
    expect(R().roomId).toBeTruthy();
    expect(G().gameMode).toBe(GameMode.ONLINE);
    expect(G().localPlayer).toBe(Player.BLANCAS);
    expect(gateway.getRoom(R().roomId!)?.status).toBe("waiting");
  });

  it("joinRoom on a waiting room → connected + guest + host snapshot applied", async () => {
    await R().createRoom();
    const roomId = R().roomId!;

    // El host coloca una pieza antes de que entre el guest (join tardío).
    G().selectPieceTypeForSetup(PieceType.BULWARK);
    G().handleTileClick(new Position(0, 1));

    // Simulamos el segundo cliente con otro store-scope no: el mismo store
    // actúa como guest tras el join (el estado local se sobrescribe).
    useRoomStore.setState({ status: "idle", roomId: null, role: null });
    stopRoomSync();
    useGameStore.getState().reset();

    await R().joinRoom(roomId);
    expect(R().status).toBe("connected");
    expect(R().role).toBe("guest");
    expect(G().gameMode).toBe(GameMode.ONLINE);
    expect(G().localPlayer).toBe(Player.NEGRAS);
    // Snapshot del host aplicado: la pieza colocada por el host está en el board.
    expect(G().board.getPieceAt(new Position(0, 1))?.type).toBe(PieceType.BULWARK);
    expect(G().currentPlayer).toBe(Player.NEGRAS);
    expect(G().isLocalPlayerTurn()).toBe(true);
  });

  it("joinRoom on missing/closed room → error + idle", async () => {
    await R().joinRoom("does-not-exist");
    expect(R().status).toBe("idle");
    expect(R().error).toBe("Room is no longer available");
    expect(G().gameMode).toBe(GameMode.PVP);
  });

  it("subscribeLobby lists waiting rooms and drops them when playing", async () => {
    const unsub = R().subscribeLobby();
    expect(R().rooms).toEqual([]);

    await R().createRoom();
    expect(R().rooms.map((r) => r.id)).toContain(R().roomId);

    const roomId = R().roomId!;
    await gateway.joinRoom(roomId); // un guest externo entra
    expect(R().rooms).toEqual([]); // ya no está waiting
    unsub();
  });

  it("host sees connected when a guest joins", async () => {
    await R().createRoom();
    expect(R().status).toBe("waiting");
    await gateway.joinRoom(R().roomId!);
    expect(R().status).toBe("connected");
  });

  it("leaveRoom → abandoned + back to idle + game reset to PVP", async () => {
    await R().createRoom();
    const roomId = R().roomId!;
    await R().leaveRoom();
    expect(R().status).toBe("idle");
    expect(R().roomId).toBeNull();
    expect(R().role).toBeNull();
    expect(gateway.getRoom(roomId)?.status).toBe("abandoned");
    expect(G().gameMode).toBe(GameMode.PVP);
    expect(G().roomId).toBeNull();
    expect(G().localPlayer).toBeNull();
  });

  it("remote abandoned → back to local with a clear error", async () => {
    await R().createRoom();
    await gateway.joinRoom(R().roomId!);
    expect(R().status).toBe("connected");
    // El otro extremo abandona la sala.
    await gateway.leaveRoom(R().roomId!);
    expect(R().status).toBe("idle");
    expect(R().error).toBe("The room was closed");
    expect(G().gameMode).toBe(GameMode.PVP);
  });

  it("createRoom without gateway → error, local play unaffected", async () => {
    useRoomStore.setState({ gateway: null });
    await R().createRoom();
    expect(R().status).toBe("error");
    expect(R().error).toBe("Multiplayer is not configured");
    expect(G().gameMode).toBe(GameMode.PVP);
    // Modo local sigue funcionando.
    G().selectPieceTypeForSetup(PieceType.BULWARK);
    expect(G().selectedPieceTypeForPlacement).toBe(PieceType.BULWARK);
  });
});

describe("roomSync", () => {
  it("pushes local mutations to the gateway", async () => {
    await R().createRoom();
    const roomId = R().roomId!;

    G().selectPieceTypeForSetup(PieceType.BULWARK);
    G().handleTileClick(new Position(0, 1));

    const remote = gateway.getRoom(roomId);
    expect(remote?.state?.board.some((p) => p.position?.x === 0 && p.position?.y === 1)).toBe(
      true,
    );
    expect(remote?.state?.currentPlayer).toBe(Player.NEGRAS);
  });

  it("applies remote snapshots without writing back (anti-loop)", async () => {
    await R().createRoom();
    const roomId = R().roomId!;
    const spy = vi.spyOn(gateway, "writeGameState");

    // Snapshot "remoto": el rival colocó una pieza y pasó el turno.
    const remote = G().toSnapshot();
    remote.board.push({
      id: "remote-1",
      type: PieceType.VANGUARD,
      owner: Player.NEGRAS,
      position: { x: 4, y: 9 },
    });
    remote.currentPlayer = Player.BLANCAS;
    remote.pieceIdCounter += 1;

    await gateway.writeGameState(roomId, remote); // simula el write del rival

    expect(G().board.getPieceAt(new Position(4, 9))?.id).toBe("remote-1");
    expect(G().currentPlayer).toBe(Player.BLANCAS);
    // Solo el write directo del test: el apply remoto no re-escribe.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stopRoomSync detaches both subscriptions", async () => {
    await R().createRoom();
    const roomId = R().roomId!;
    stopRoomSync();

    const before = gateway.getRoom(roomId)?.state;
    G().selectPieceTypeForSetup(PieceType.BULWARK);
    G().handleTileClick(new Position(0, 1));
    expect(gateway.getRoom(roomId)?.state).toBe(before);
  });
});

describe("startRoomSync standalone", () => {
  it("pushes only when the snapshot changes", async () => {
    await R().createRoom();
    const spy = vi.spyOn(gateway, "writeGameState");

    // Cambio efímero que no entra en el snapshot (selección sin colocar).
    G().selectPieceTypeForSetup(PieceType.BULWARK);
    expect(spy).not.toHaveBeenCalled();

    // Una colocación real sí cambia el snapshot.
    G().handleTileClick(new Position(0, 1));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
