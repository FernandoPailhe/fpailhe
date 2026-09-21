import type { GameSnapshot } from "../domain/entities/GameSnapshot";
import {
  roomAdmitsJoin,
  roomAdmitsResume,
  WAITING_ROOM_MAX_AGE_MS,
  type RoomRecord,
  type RoomsGateway,
  type RoomSummary,
  type RoomUnsubscribe,
  type CreatedRoom,
} from "../domain/interfaces/RoomsGateway";

type RoomListener = (room: RoomRecord | null) => void;
type LobbyListener = (rooms: RoomSummary[]) => void;

export interface InMemoryRoomsGatewayOptions {
  /** Reloj inyectable: los tests controlan el paso del tiempo sin timers. */
  now?: () => number;
  /** Generador de credenciales del host; inyectable para tests deterministas. */
  createToken?: () => string;
  /**
   * Simula la semántica de RTDB: al persistir elimina null/undefined, arrays
   * vacíos y objetos que quedan vacíos. Sin esto los tests no reproducen el
   * eco que revertía las selecciones del usuario con Firebase real.
   */
  simulateRtdbStrip?: boolean;
}

/**
 * Replica lo que RTDB hace con un valor al escribirlo: null/undefined, arrays
 * vacíos y objetos sin claves se descartan; arrays con elementos se conservan.
 */
function stripRtdb(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return value.map((item) => stripRtdb(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const stripped = stripRtdb(v);
      if (stripped !== undefined) out[key] = stripped;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value;
}

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
  private readonly now: () => number;
  private readonly createToken: () => string;
  private readonly strip: boolean;

  constructor(options: InMemoryRoomsGatewayOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.createToken = options.createToken ?? (() => `host-${Math.random().toString(36).slice(2)}`);
    this.strip = options.simulateRtdbStrip ?? false;
  }

  private persistState(snapshot: GameSnapshot): GameSnapshot | null {
    if (!this.strip) return snapshot;
    return (stripRtdb(snapshot) as GameSnapshot | undefined) ?? null;
  }

  private emitRoom(roomId: string): void {
    const room = this.rooms.get(roomId) ?? null;
    this.roomListeners.get(roomId)?.forEach((listener) => listener(room));
  }

  private emitLobby(): void {
    const rooms = this.waitingRooms();
    this.lobbyListeners.forEach((listener) => listener(rooms));
  }

  private waitingRooms(): RoomSummary[] {
    const now = this.now();
    return [...this.rooms.entries()]
      .filter(([, room]) => roomAdmitsJoin(room, now))
      .map(([id, room]) => ({ id, createdAt: room.createdAt, status: room.status }));
  }

  /** Helper de inspección para tests (no forma parte del puerto). */
  getRoom(roomId: string): RoomRecord | null {
    return this.rooms.get(roomId) ?? null;
  }

  async createRoom(initial: GameSnapshot): Promise<CreatedRoom> {
    const roomId = `room-${++this.idCounter}`;
    const now = this.now();
    const hostToken = this.createToken();
    const record: RoomRecord = {
      createdAt: now,
      updatedAt: now,
      status: "waiting",
      guestJoinedAt: null,
      hostConnection: "connected",
      hostDisconnectedAt: null,
      expiresAt: now + WAITING_ROOM_MAX_AGE_MS,
      hostToken,
      state: this.persistState(initial),
    };
    // RTDB descarta los null del record completo, no solo los del state.
    this.rooms.set(roomId, this.strip ? (stripRtdb(record) as RoomRecord) : record);
    this.emitRoom(roomId);
    this.emitLobby();
    return { roomId, hostToken };
  }

  async joinRoom(roomId: string): Promise<RoomRecord | null> {
    const room = this.rooms.get(roomId);
    if (!room || !roomAdmitsJoin(room, this.now())) return null;
    room.status = "playing";
    room.guestJoinedAt = this.now();
    room.updatedAt = this.now();
    this.emitRoom(roomId);
    this.emitLobby();
    return room;
  }

  async resumeRoom(roomId: string, hostToken: string): Promise<RoomRecord | null> {
    const room = this.rooms.get(roomId);
    if (!room || !roomAdmitsResume(room, hostToken, this.now())) return null;
    room.hostConnection = "connected";
    room.hostDisconnectedAt = null;
    room.updatedAt = this.now();
    this.emitRoom(roomId);
    return room;
  }

  async disconnectHost(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.status === "abandoned" || room.status === "finished") return;
    room.hostConnection = "disconnected";
    room.hostDisconnectedAt = this.now();
    room.updatedAt = this.now();
    this.emitRoom(roomId);
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
    room.state = this.persistState(snapshot);
    room.updatedAt = this.now();
    this.emitRoom(roomId);
  }

  async leaveRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.status = "abandoned";
    room.hostConnection = "disconnected";
    room.updatedAt = this.now();
    this.emitRoom(roomId);
    this.emitLobby();
  }
}
