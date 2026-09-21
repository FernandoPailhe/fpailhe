import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGameStore, useGameStore } from "./GameState";
import { useRoomStore } from "./RoomState";
import { startRoomSync, stopRoomSync } from "./roomSync";
import { clearHostCredential } from "./hostCredential";
import { InMemoryRoomsGateway } from "../infrastructure/InMemoryRoomsGateway";
import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GamePhase, SetupTurnMode, type RoomSetupMode } from "../domain/constants/GameRules";
import { Position } from "../domain/entities/Position";

const G = () => useGameStore.getState();
const R = () => useRoomStore.getState();
const pos = (x: number, y: number) => new Position(x, y);

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

afterEach(() => {
  vi.useRealTimers();
});

type ClientStore = ReturnType<typeof createGameStore>;

/**
 * Harness de dos clientes REALES: stores Zustand independientes conectados al
 * mismo gateway (detecta carreras de suscripción y sobrescrituras que el
 * singleton + `becomeClient` no veía). Cada cliente replica el orden exacto
 * de RoomState: snapshot/contexto primero, sync después.
 */
async function connectHost(
  setupMode: RoomSetupMode,
  setupTurnMode: SetupTurnMode = SetupTurnMode.ALTERNATING,
): Promise<{ store: ClientStore; roomId: string; hostToken: string; stop: () => void }> {
  const store = createGameStore();
  store.getState().prepareOnlineGame(setupMode, setupTurnMode);
  const { roomId, hostToken } = await gateway.createRoom(store.getState().toSnapshot());
  store.getState().setOnlineContext(roomId, Player.BLANCAS);
  const stop = startRoomSync(gateway, roomId, { store });
  return { store, roomId, hostToken, stop };
}

async function connectGuest(roomId: string): Promise<ClientStore> {
  const store = createGameStore();
  const room = await gateway.joinRoom(roomId);
  if (!room) throw new Error("joinRoom rejected");
  // Orden de bootstrap: aplicar remoto → contexto → recién ahí suscribirse.
  if (room.state) store.getState().applyRemoteSnapshot(room.state);
  store.getState().setOnlineContext(roomId, Player.NEGRAS);
  startRoomSync(gateway, roomId, { store });
  return store;
}

describe("online two-client flow", () => {
  it("quick: guest recibe el snapshot PLAYING y su estado vacío no lo pisa", async () => {
    const host = await connectHost("quick");
    const guest = await connectGuest(host.roomId);

    // Ambos clientes ven el mismo estado autoritativo.
    for (const store of [host.store, guest]) {
      expect(store.getState().gamePhase).toBe(GamePhase.PLAYING);
      expect(store.getState().board.getAllPieces()).toHaveLength(10);
      expect(store.getState().player1State.getBenchPieces()).toHaveLength(3);
      expect(store.getState().player2State.getBenchPieces()).toHaveLength(3);
      expect(store.getState().currentPlayer).toBe(Player.BLANCAS);
    }
    // El bootstrap del guest no sobrescribió la sala con su SETUP vacío.
    expect(gateway.getRoom(host.roomId)?.state?.gamePhase).toBe(GamePhase.PLAYING);
    expect(gateway.getRoom(host.roomId)?.state?.board).toHaveLength(10);
  });

  it("quick: guest no puede actuar fuera de turno; movimientos alternan ambos lados", async () => {
    const host = await connectHost("quick");
    const guest = await connectGuest(host.roomId);

    // Turno de BLANCAS: el guest está bloqueado.
    expect(guest.getState().isLocalPlayerTurn()).toBe(false);
    guest.getState().handleTileClick(pos(2, 8));
    expect(guest.getState().selectedPiece).toBeNull();

    // Host mueve → el guest recibe el snapshot con turno NEGRAS.
    host.store.getState().handleTileClick(pos(2, 2));
    host.store.getState().handleTileClick(pos(2, 4));
    expect(guest.getState().board.getPieceAt(pos(2, 4))?.type).toBe(PieceType.PIONEER);
    expect(guest.getState().currentPlayer).toBe(Player.NEGRAS);
    expect(guest.getState().isLocalPlayerTurn()).toBe(true);

    // Guest mueve → el host recibe el snapshot con turno BLANCAS.
    guest.getState().handleTileClick(pos(2, 8));
    guest.getState().handleTileClick(pos(2, 6));
    expect(host.store.getState().board.getPieceAt(pos(2, 6))?.type).toBe(PieceType.PIONEER);
    expect(host.store.getState().currentPlayer).toBe(Player.BLANCAS);
  });

  it("manual: host elige FORT, coloca y el guest recibe el turno NEGRAS", async () => {
    const host = await connectHost("manual");
    const guest = await connectGuest(host.roomId);

    expect(guest.getState().gamePhase).toBe(GamePhase.SETUP);
    expect(guest.getState().isLocalPlayerTurn()).toBe(false);
    // El guest no puede elegir ni colocar fuera de turno.
    guest.getState().selectPieceTypeForSetup(PieceType.FORT);
    expect(guest.getState().selectedPieceTypeForPlacement).toBeNull();

    host.store.getState().selectPieceTypeForSetup(PieceType.FORT);
    host.store.getState().handleTileClick(pos(0, 1));

    expect(guest.getState().board.getPieceAt(pos(0, 1))?.type).toBe(PieceType.FORT);
    expect(guest.getState().currentPlayer).toBe(Player.NEGRAS);
    expect(guest.getState().isLocalPlayerTurn()).toBe(true);

    guest.getState().selectPieceTypeForSetup(PieceType.FORT);
    guest.getState().handleTileClick(pos(0, 9));
    expect(host.store.getState().board.getPieceAt(pos(0, 9))?.type).toBe(PieceType.FORT);
    expect(host.store.getState().currentPlayer).toBe(Player.BLANCAS);
  });

  it("manual: los 10 placements + 6 bench picks alternados llegan a PLAYING", async () => {
    const host = await connectHost("manual");
    const guest = await connectGuest(host.roomId);
    const whiteSpots = [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2), pos(0, 3)];
    const blackSpots = [pos(0, 7), pos(1, 7), pos(0, 8), pos(1, 8), pos(0, 9)];
    const types = [
      PieceType.FORT,
      PieceType.STRIKER,
      PieceType.PIONEER,
      PieceType.FORT,
      PieceType.STRIKER,
    ];

    types.forEach((type, i) => {
      host.store.getState().selectPieceTypeForSetup(type);
      host.store.getState().handleTileClick(whiteSpots[i]!);
      guest.getState().selectPieceTypeForSetup(type);
      guest.getState().handleTileClick(blackSpots[i]!);
    });
    expect(host.store.getState().gamePhase).toBe(GamePhase.BENCH_SELECTION);
    expect(guest.getState().gamePhase).toBe(GamePhase.BENCH_SELECTION);

    [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER].forEach((type) =>
      host.store.getState().selectPieceTypeForBench(type),
    );
    expect(guest.getState().currentPlayer).toBe(Player.NEGRAS);
    [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER].forEach((type) =>
      guest.getState().selectPieceTypeForBench(type),
    );

    for (const store of [host.store, guest]) {
      expect(store.getState().gamePhase).toBe(GamePhase.PLAYING);
      expect(store.getState().currentPlayer).toBe(Player.BLANCAS);
      expect(store.getState().player1State.getBenchPieces()).toHaveLength(3);
      expect(store.getState().player2State.getBenchPieces()).toHaveLength(3);
    }
  });

  it("hidden: cada cliente configura 5+3 en su turno; ambos llegan a PLAYING", async () => {
    const host = await connectHost("manual", SetupTurnMode.HIDDEN);
    const guest = await connectGuest(host.roomId);

    // El guest hereda el modo del snapshot del host y espera su turno.
    expect(guest.getState().setupMode).toBe(SetupTurnMode.HIDDEN);
    expect(guest.getState().gamePhase).toBe(GamePhase.SETUP);
    expect(guest.getState().isSetupTurnForLocalPlayer()).toBe(false);
    expect(host.store.getState().isSetupTurnForLocalPlayer()).toBe(true);

    const whiteSpots = [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2), pos(0, 3)];
    const blackSpots = [pos(0, 7), pos(1, 7), pos(0, 8), pos(1, 8), pos(0, 9)];
    const types = [
      PieceType.FORT,
      PieceType.STRIKER,
      PieceType.PIONEER,
      PieceType.FORT,
      PieceType.STRIKER,
    ];

    // Host (BLANCAS) completa su setup: el guest sigue sin poder actuar.
    types.forEach((type, i) => {
      host.store.getState().selectPieceTypeForSetup(type);
      host.store.getState().handleTileClick(whiteSpots[i]!);
      expect(host.store.getState().currentPlayer).toBe(Player.BLANCAS);
    });
    [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER].forEach((type) =>
      host.store.getState().selectPieceTypeForBench(type),
    );

    expect(guest.getState().setupCompleted).toEqual({ player1: true, player2: false });
    expect(guest.getState().currentPlayer).toBe(Player.NEGRAS);
    expect(guest.getState().isSetupTurnForLocalPlayer()).toBe(true);
    expect(host.store.getState().isSetupTurnForLocalPlayer()).toBe(false);

    // Guest (NEGRAS) completa el suyo → PLAYING en ambos lados.
    types.forEach((type, i) => {
      guest.getState().selectPieceTypeForSetup(type);
      guest.getState().handleTileClick(blackSpots[i]!);
    });
    [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER].forEach((type) =>
      guest.getState().selectPieceTypeForBench(type),
    );

    for (const store of [host.store, guest]) {
      expect(store.getState().setupCompleted).toEqual({ player1: true, player2: true });
      expect(store.getState().gamePhase).toBe(GamePhase.PLAYING);
      expect(store.getState().currentPlayer).toBe(Player.BLANCAS);
      expect(store.getState().board.getAllPieces()).toHaveLength(10);
    }
  });

  it("resume dentro de la ventana restaura rol/snapshot; vencida se rechaza", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000_000);
    const host = await connectHost("quick");
    const guest = await connectGuest(host.roomId);

    // Host cierra sin leave: se corta su sync y el server marca desconexión.
    host.stop();
    await gateway.disconnectHost(host.roomId);
    expect(gateway.getRoom(host.roomId)?.status).toBe("playing");

    // Vuelve dentro de la ventana: mismo navegador, credencial válida.
    vi.setSystemTime(5_000_000 + 15_000);
    const room = await gateway.resumeRoom(host.roomId, host.hostToken);
    expect(room?.status).toBe("playing");
    expect(room?.hostConnection).toBe("connected");

    const returning = createGameStore();
    if (room?.state) returning.getState().applyRemoteSnapshot(room.state);
    returning.getState().setOnlineContext(host.roomId, Player.BLANCAS);
    startRoomSync(gateway, host.roomId, { store: returning });
    expect(returning.getState().gamePhase).toBe(GamePhase.PLAYING);
    expect(returning.getState().board.getAllPieces()).toHaveLength(10);

    // Segunda caída: al vencer la ventana el resume se rechaza.
    await gateway.disconnectHost(host.roomId);
    vi.setSystemTime(5_000_000 + 15_000 + 31_000);
    expect(await gateway.resumeRoom(host.roomId, host.hostToken)).toBeNull();
    void guest;
  });
});

describe("eco de snapshot con semántica RTDB (regresión: clicks revertidos)", () => {
  it("la selección efímera no se revierte por el eco del write propio", async () => {
    // RTDB elimina null/[] vacíos/{ } al persistir: el state que vuelve por
    // onValue difiere en bytes del local aunque sea el mismo estado.
    const rtdbGateway = new InMemoryRoomsGateway({ simulateRtdbStrip: true });
    const host = createGameStore();
    host.getState().prepareOnlineGame("manual");
    const { roomId } = await rtdbGateway.createRoom(host.getState().toSnapshot());
    host.getState().setOnlineContext(roomId, Player.BLANCAS);
    const stop = startRoomSync(rtdbGateway, roomId, { store: host });
    const writeSpy = vi.spyOn(rtdbGateway, "writeGameState");

    // El eco del snapshot inicial (stripped) no debe revertir nada ni escribir.
    expect(host.getState().selectedPieceTypeForPlacement).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();

    // Elegir tipo de pieza es efímero: no entra al snapshot, no escribe, y
    // sobre todo NO se revierte cuando el eco del estado llega de vuelta.
    host.getState().selectPieceTypeForSetup(PieceType.FORT);
    expect(host.getState().selectedPieceTypeForPlacement).toBe(PieceType.FORT);
    expect(host.getState().validMoves.length).toBeGreaterThan(0);
    expect(writeSpy).not.toHaveBeenCalled();

    // Colocar sí cambia el snapshot → un write; el eco stripped no debe
    // volver a aplicar ni pisar el estado.
    host.getState().handleTileClick(pos(0, 1));
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(host.getState().currentPlayer).toBe(Player.NEGRAS);
    expect(host.getState().board.getPieceAt(pos(0, 1))?.type).toBe(PieceType.FORT);

    stop();
  });

  it("quick: el host puede seleccionar y completar un movimiento sin eco", async () => {
    const rtdbGateway = new InMemoryRoomsGateway({ simulateRtdbStrip: true });
    const host = createGameStore();
    host.getState().prepareOnlineGame("quick");
    const { roomId } = await rtdbGateway.createRoom(host.getState().toSnapshot());
    host.getState().setOnlineContext(roomId, Player.BLANCAS);
    const stopHost = startRoomSync(rtdbGateway, roomId, { store: host });

    const guest = createGameStore();
    const room = await rtdbGateway.joinRoom(roomId);
    if (room?.state) guest.getState().applyRemoteSnapshot(room.state);
    guest.getState().setOnlineContext(roomId, Player.NEGRAS);
    const stopGuest = startRoomSync(rtdbGateway, roomId, { store: guest });

    // Click 1: selecciona la pieza. Antes del fix el eco revertía esto.
    host.getState().handleTileClick(pos(2, 2));
    expect(host.getState().selectedPiece?.type).toBe(PieceType.PIONEER);
    expect(host.getState().validMoves.length).toBeGreaterThan(0);

    // Click 2: el movimiento se completa y el guest lo recibe.
    host.getState().handleTileClick(pos(2, 4));
    expect(host.getState().currentPlayer).toBe(Player.NEGRAS);
    expect(guest.getState().board.getPieceAt(pos(2, 4))?.type).toBe(PieceType.PIONEER);
    expect(guest.getState().currentPlayer).toBe(Player.NEGRAS);
    expect(guest.getState().isLocalPlayerTurn()).toBe(true);

    stopHost();
    stopGuest();
  });
});

describe("single-store smoke tests (RoomState wiring)", () => {
  it("host can move after guest joins a quick-start room", async () => {
    await R().createRoom("quick");
    const roomId = R().roomId!;

    await gateway.joinRoom(roomId);
    expect(R().status).toBe("connected");
    expect(G().gamePhase).toBe(GamePhase.PLAYING);
    expect(G().isLocalPlayerTurn()).toBe(true);

    G().handleTileClick(pos(2, 2));
    expect(G().selectedPiece).not.toBeNull();
    G().handleTileClick(pos(2, 4));
    expect(G().currentPlayer).toBe(Player.NEGRAS);
  });
});
