import type { GameSnapshot } from "../domain/entities/GameSnapshot";
import type {
  RoomRecord,
  RoomsGateway,
  RoomSummary,
  RoomUnsubscribe,
} from "../domain/interfaces/RoomsGateway";

const WAITING_ROOM_MAX_AGE_MS = 30 * 60 * 1000;

type RoomListener = (room: RoomRecord | null) => void;
type LobbyListener = (rooms: RoomSummary[]) => void;

/**
 * Adaptador `RoomsGateway` en memoria. Emite a los suscriptores de forma
 * síncrona en cada mutación y una vez al suscribirse (misma semántica que
 * `onValue` de RTDB). Pensado para tests y desarrollo sin Firebase.
 */
export class InMemoryRoomsGateway implements RoomsGateway {
  private rooms = new Map<string, RoomRecord>();
  private roomListeners = new Map<string, Set<RoomListener>>();
  private lobbyListeners = new Set<LobbyListener>();
  private idCounter = 0;

  private emitRoom(roomId: string): void {
    const room = this.rooms.get(roomId) ?? null;
    this.roomListeners.get(roomId)?.forEach((listener) => listener(room));
  }

  private emitLobby(): void {
    const rooms = this.waitingRooms();
    this.lobbyListeners.forEach((listener) => listener(rooms));
  }

  private waitingRooms(): RoomSummary[] {
    const cutoff = Date.now() - WAITING_ROOM_MAX_AGE_MS;
    return [...this.rooms.entries()]
      .filter(([, room]) => room.status === "waiting" && room.createdAt >= cutoff)
      .map(([id, room]) => ({ id, createdAt: room.createdAt, status: room.status }));
  }

  /** Helper de inspección para tests (no forma parte del puerto). */
  getRoom(roomId: string): RoomRecord | null {
    return this.rooms.get(roomId) ?? null;
  }

  async createRoom(initial: GameSnapshot): Promise<string> {
    const roomId = `room-${++this.idCounter}`;
    this.rooms.set(roomId, {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "waiting",
      guestJoinedAt: null,
      state: initial,
    });
    this.emitRoom(roomId);
    this.emitLobby();
    return roomId;
  }

  async joinRoom(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== "waiting") return false;
    room.status = "playing";
    room.guestJoinedAt = Date.now();
    room.updatedAt = Date.now();
    this.emitRoom(roomId);
    this.emitLobby();
    return true;
  }

  subscribeRoom(roomId: string, callback: RoomListener): RoomUnsubscribe {
    const listeners = this.roomListeners.get(roomId) ?? new Set<RoomListener>();
    listeners.add(callback);
    this.roomListeners.set(roomId, listeners);
    callback(this.rooms.get(roomId) ?? null);
    return () => {
      listeners.delete(callback);
    };
  }

  subscribeWaitingRooms(callback: LobbyListener): RoomUnsubscribe {
    this.lobbyListeners.add(callback);
    callback(this.waitingRooms());
    return () => {
      this.lobbyListeners.delete(callback);
    };
  }

  async writeGameState(roomId: string, snapshot: GameSnapshot): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("La sala no existe");
    room.state = snapshot;
    room.updatedAt = Date.now();
    this.emitRoom(roomId);
  }

  async leaveRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.status = "abandoned";
    room.updatedAt = Date.now();
    this.emitRoom(roomId);
    this.emitLobby();
  }
}
