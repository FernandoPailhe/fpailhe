import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "./GameState";
import { useRoomStore } from "./RoomState";
import { stopRoomSync } from "./roomSync";
import { clearHostCredential } from "./hostCredential";
import { InMemoryRoomsGateway } from "../infrastructure/InMemoryRoomsGateway";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GameMode, GamePhase } from "../domain/constants/GameRules";
import { Position } from "../domain/entities/Position";
import type { RoomSummary } from "../domain/interfaces/RoomsGateway";

const G = () => useGameStore.getState();
const R = () => useRoomStore.getState();

let gateway: InMemoryRoomsGateway;

beforeEach(async () => {
  // leaveRoom es idempotente: corta roomSync + watcher de status y resetea.
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

afterEach(() => {
  vi.useRealTimers();
});

describe("useRoomStore", () => {
  it("createRoom → waiting + host + ONLINE context (BLANCAS)", async () => {
    await R().createRoom("manual");
    expect(R().status).toBe("waiting");
    expect(R().role).toBe("host");
    expect(R().roomId).toBeTruthy();
    expect(G().gameMode).toBe(GameMode.ONLINE);
    expect(G().localPlayer).toBe(Player.BLANCAS);
    expect(gateway.getRoom(R().roomId!)?.status).toBe("waiting");
  });

  it('createRoom("manual") publica un snapshot SETUP vacío con Blancas al turno', async () => {
    // El orden viejo dejaba que la UI mutara el juego antes de crear la sala;
    // ahora el snapshot nace del prepareOnlineGame determinista.
    G().selectPieceTypeForSetup(PieceType.FORT); // basura previa que debe limpiarse
    await R().createRoom("manual");
    const remote = gateway.getRoom(R().roomId!)?.state;
    expect(remote?.gamePhase).toBe(GamePhase.SETUP);
    expect(remote?.board ?? []).toHaveLength(0);
    expect(remote?.currentPlayer).toBe(Player.BLANCAS);
    expect(G().selectedPieceTypeForPlacement).toBeNull();
  });

  it('createRoom("quick") publica un snapshot PLAYING con ejércitos completos', async () => {
    await R().createRoom("quick");
    const remote = gateway.getRoom(R().roomId!)?.state;
    expect(remote?.gamePhase).toBe(GamePhase.PLAYING);
    expect(remote?.board).toHaveLength(10);
    expect(remote?.player1.benchPieces).toHaveLength(3);
    expect(remote?.player2.benchPieces).toHaveLength(3);
    expect(remote?.currentPlayer).toBe(Player.BLANCAS);
    expect(G().gamePhase).toBe(GamePhase.PLAYING);
  });

  it("joinRoom on a waiting room → connected + guest + host snapshot applied", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;

    // El host coloca una pieza antes de que entre el guest (join tardío).
    G().selectPieceTypeForSetup(PieceType.FORT);
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
    expect(G().board.getPieceAt(new Position(0, 1))?.type).toBe(PieceType.FORT);
    expect(G().currentPlayer).toBe(Player.NEGRAS);
    expect(G().isLocalPlayerTurn()).toBe(true);
  });

  it("joinRoom no pisa el snapshot remoto con el estado local vacío", async () => {
    await R().createRoom("quick");
    const roomId = R().roomId!;

    // El guest llega con un store fresco (SETUP vacío) y hace join.
    useRoomStore.setState({ status: "idle", roomId: null, role: null });
    stopRoomSync();
    useGameStore.getState().reset();

    await R().joinRoom(roomId);
    expect(R().status).toBe("connected");
    expect(G().gamePhase).toBe(GamePhase.PLAYING);
    // La sala conserva el snapshot autoritativo del host.
    expect(gateway.getRoom(roomId)?.state?.gamePhase).toBe(GamePhase.PLAYING);
    expect(gateway.getRoom(roomId)?.state?.board).toHaveLength(10);
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

    await R().createRoom("manual");
    expect(R().rooms.map((r) => r.id)).toContain(R().roomId);

    const roomId = R().roomId!;
    await gateway.joinRoom(roomId); // un guest externo entra
    expect(R().rooms).toEqual([]); // ya no está waiting
    unsub();
  });

  it("host sees connected when a guest joins", async () => {
    await R().createRoom("manual");
    expect(R().status).toBe("waiting");
    await gateway.joinRoom(R().roomId!);
    expect(R().status).toBe("connected");
  });

  it("leaveRoom → abandoned + back to idle + game reset to PVP", async () => {
    await R().createRoom("manual");
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
    await R().createRoom("manual");
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
    await R().createRoom("manual");
    expect(R().status).toBe("error");
    expect(R().error).toBe("Multiplayer is not configured");
    expect(G().gameMode).toBe(GameMode.PVP);
    // Modo local sigue funcionando.
    G().selectPieceTypeForSetup(PieceType.FORT);
    expect(G().selectedPieceTypeForPlacement).toBe(PieceType.FORT);
  });
});

describe("room lifecycle: disconnect/resume con ventana de gracia", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  it("disconnect no abandona la sala y el host puede reanudar antes de 30 s", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;
    const { hostToken } = gateway.getRoom(roomId)!;

    // Orden del fallo reportado: cierre/refresh del host sin leaveRoom →
    // antes la sala pasaba a "abandoned" de inmediato.
    await gateway.disconnectHost(roomId);
    expect(gateway.getRoom(roomId)?.status).toBe("waiting");
    expect(gateway.getRoom(roomId)?.hostConnection).toBe("disconnected");

    vi.setSystemTime(1_000_000 + 29_999);
    const resumed = await gateway.resumeRoom(roomId, hostToken);
    expect(resumed?.status).toBe("waiting");
    expect(resumed?.hostConnection).toBe("connected");
    expect(resumed?.hostDisconnectedAt).toBeNull();
  });

  it("rechaza el resume una vez vencida la ventana de gracia", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;
    const { hostToken } = gateway.getRoom(roomId)!;

    await gateway.disconnectHost(roomId);
    vi.setSystemTime(1_000_000 + 30_001);
    expect(await gateway.resumeRoom(roomId, hostToken)).toBeNull();
  });

  it("rechaza un token incorrecto y el leave explícito sigue siendo inmediato", async () => {
    await R().createRoom("quick");
    const roomId = R().roomId!;
    const { hostToken } = gateway.getRoom(roomId)!;

    await gateway.disconnectHost(roomId);
    expect(await gateway.resumeRoom(roomId, "wrong-token")).toBeNull();

    await gateway.leaveRoom(roomId);
    expect(await gateway.resumeRoom(roomId, hostToken)).toBeNull();
  });

  it("un guest puede entrar a una sala waiting aunque el host esté caído", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;
    await gateway.disconnectHost(roomId);
    vi.setSystemTime(1_000_000 + 10_000);
    const room = await gateway.joinRoom(roomId);
    expect(room?.status).toBe("playing");
  });

  it("salas expiradas no se listan ni admiten join", async () => {
    const snapshot = G().toSnapshot();
    const { roomId } = await gateway.createRoom(snapshot);

    const emissions: RoomSummary[][] = [];
    const unsub = gateway.subscribeWaitingRooms((rooms) => emissions.push(rooms));
    expect(emissions.at(-1)?.map((r) => r.id)).toContain(roomId);

    vi.setSystemTime(1_000_000 + 31 * 60 * 1000);
    // emitLobby solo corre con una mutación: otra sala provoca el re-emit.
    await gateway.leaveRoom((await gateway.createRoom(snapshot)).roomId);
    expect(emissions.at(-1)?.map((r) => r.id)).not.toContain(roomId);
    expect(await gateway.joinRoom(roomId)).toBeNull();
    unsub();
  });

  it("RoomSummary nunca transporta la credencial del host", async () => {
    const { roomId, hostToken } = await gateway.createRoom(G().toSnapshot());
    let summaries: RoomSummary[] = [];
    const unsub = gateway.subscribeWaitingRooms((rooms) => (summaries = rooms));
    expect(summaries).toHaveLength(1);
    expect("hostToken" in summaries[0]!).toBe(false);
    expect(JSON.stringify(summaries[0])).not.toContain(hostToken);
    expect(gateway.getRoom(roomId)?.hostToken).toBe(hostToken);
    unsub();
  });

  it("enterRoom reanuda como host cuando hay credencial local (refresh < 30 s)", async () => {
    await R().createRoom("quick");
    const roomId = R().roomId!;

    // Simular refresh: sync cortada + stores reseteados, SIN leaveRoom.
    stopRoomSync();
    useGameStore.getState().reset();
    useRoomStore.setState({ status: "idle", roomId: null, role: null });
    await gateway.disconnectHost(roomId);

    vi.setSystemTime(1_000_000 + 5_000);
    await R().enterRoom(roomId);
    expect(R().role).toBe("host");
    expect(R().status).toBe("waiting");
    expect(R().roomId).toBe(roomId);
    expect(G().localPlayer).toBe(Player.BLANCAS);
    // Snapshot remoto restaurado: la sala quick sigue en PLAYING.
    expect(G().gamePhase).toBe(GamePhase.PLAYING);
    expect(G().board.getAllPieces()).toHaveLength(10);
  });

  it("enterRoom cae a join cuando la sala ya venció", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;
    stopRoomSync();
    useRoomStore.setState({ status: "idle", roomId: null, role: null });
    await gateway.disconnectHost(roomId);

    vi.setSystemTime(1_000_000 + 31_000);
    await R().enterRoom(roomId);
    expect(R().status).toBe("idle");
    expect(R().role).toBeNull();
    expect(R().error).toBe("Room is no longer available");
  });
});

describe("roomSync", () => {
  it("pushes local mutations to the gateway", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;

    G().selectPieceTypeForSetup(PieceType.FORT);
    G().handleTileClick(new Position(0, 1));

    const remote = gateway.getRoom(roomId);
    expect(
      (remote?.state?.board ?? []).some((p) => p.position?.x === 0 && p.position?.y === 1),
    ).toBe(true);
    expect(remote?.state?.currentPlayer).toBe(Player.NEGRAS);
  });

  it("applies remote snapshots without writing back (anti-loop)", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;
    const spy = vi.spyOn(gateway, "writeGameState");

    // Snapshot "remoto": el rival colocó una pieza y pasó el turno.
    const remote = G().toSnapshot();
    remote.board = [
      ...(remote.board ?? []),
      {
        id: "remote-1",
        type: PieceType.STRIKER,
        owner: Player.NEGRAS,
        position: { x: 4, y: 9 },
      },
    ];
    remote.currentPlayer = Player.BLANCAS;
    remote.pieceIdCounter += 1;

    await gateway.writeGameState(roomId, remote); // simula el write del rival

    expect(G().board.getPieceAt(new Position(4, 9))?.id).toBe("remote-1");
    expect(G().currentPlayer).toBe(Player.BLANCAS);
    // Solo el write directo del test: el apply remoto no re-escribe.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stopRoomSync detaches both subscriptions", async () => {
    await R().createRoom("manual");
    const roomId = R().roomId!;
    stopRoomSync();

    const before = gateway.getRoom(roomId)?.state;
    G().selectPieceTypeForSetup(PieceType.FORT);
    G().handleTileClick(new Position(0, 1));
    expect(gateway.getRoom(roomId)?.state).toBe(before);
  });
});

describe("startRoomSync standalone", () => {
  it("pushes only when the snapshot changes", async () => {
    await R().createRoom("manual");
    const spy = vi.spyOn(gateway, "writeGameState");

    // Cambio efímero que no entra en el snapshot (selección sin colocar).
    G().selectPieceTypeForSetup(PieceType.FORT);
    expect(spy).not.toHaveBeenCalled();

    // Una colocación real sí cambia el snapshot.
    G().handleTileClick(new Position(0, 1));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
