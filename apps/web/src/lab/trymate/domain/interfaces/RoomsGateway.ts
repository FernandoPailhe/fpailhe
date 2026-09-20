import type { GameSnapshot } from "../entities/GameSnapshot";

export type RoomStatus = "waiting" | "playing" | "finished" | "abandoned";
export type HostConnection = "connected" | "disconnected";

/** Ventana en la que el host puede reanudar su sala tras un refresh/cierre. */
export const ROOM_RECONNECT_GRACE_MS = 30_000;
/** Tiempo máximo que una sala "waiting" permanece lista/joinable. */
export const WAITING_ROOM_MAX_AGE_MS = 30 * 60 * 1000;

export interface RoomRecord {
  createdAt: number;
  updatedAt: number;
  status: RoomStatus;
  guestJoinedAt: number | null;
  /** Presencia del host: la escribe onDisconnect o el resume, no un leave. */
  hostConnection: HostConnection;
  /** Timestamp del último corte del host; null si figura conectado. */
  hostDisconnectedAt: number | null;
  /**
   * TTL de la sala mientras está "waiting" (join + listing). El deadline
   * real de join/resume lo calcula `roomAdmissionDeadline`, que acota a
   * `hostDisconnectedAt + ROOM_RECONNECT_GRACE_MS` cuando el host cayó.
   */
  expiresAt: number;
  /**
   * Credencial opaca del host para reanudar tras reconexión. Solo se
   * compara en `resumeRoom`: nunca se expone en RoomSummary, URLs ni logs.
   */
  hostToken: string;
  /** Último snapshot del juego publicado en la sala. */
  state: GameSnapshot | null;
}

export interface RoomSummary {
  id: string;
  createdAt: number;
  status: RoomStatus;
}

export interface CreatedRoom {
  roomId: string;
  hostToken: string;
}

export type RoomUnsubscribe = () => void;

/**
 * Último instante (epoch ms) en que la sala admite join/resume, o null si
 * ya no admite ninguno.
 * - waiting: `expiresAt`, acotado a `hostDisconnectedAt + grace` si el host
 *   está desconectado (join del guest y resume del host comparten deadline).
 * - playing: solo resume del host; si figura conectado no hay deadline
 *   (la credencial es la autorización — cubre la carrera en que el
 *   onDisconnect del socket viejo aún no llegó al servidor).
 */
export function roomAdmissionDeadline(room: RoomRecord): number | null {
  if (room.status === "abandoned" || room.status === "finished") return null;
  if (room.status === "waiting") {
    const disconnectedAt = room.hostConnection === "disconnected" ? room.hostDisconnectedAt : null;
    return disconnectedAt === null
      ? room.expiresAt
      : Math.min(room.expiresAt, disconnectedAt + ROOM_RECONNECT_GRACE_MS);
  }
  if (room.hostDisconnectedAt === null) return Number.POSITIVE_INFINITY;
  return room.hostDisconnectedAt + ROOM_RECONNECT_GRACE_MS;
}

/** Una sala "waiting" admite un join mientras no se venza su deadline. */
export function roomAdmitsJoin(room: RoomRecord | null, now = Date.now()): boolean {
  if (!room || room.status !== "waiting") return false;
  const deadline = roomAdmissionDeadline(room);
  return deadline !== null && now <= deadline;
}

/**
 * El resume del host exige credencial válida y deadline vigente. En salas
 * "playing" con el host todavía marcado "connected" el deadline es abierto:
 * la credencial basta (reconexión antes de que el servidor detecte la caída).
 */
export function roomAdmitsResume(
  room: RoomRecord | null,
  hostToken: string,
  now = Date.now(),
): boolean {
  if (!room || room.hostToken !== hostToken) return false;
  const deadline = roomAdmissionDeadline(room);
  return deadline !== null && now <= deadline;
}

/**
 * Puerto de persistencia de salas multiplayer. El dominio del juego, los
 * stores y la UI dependen solo de este contrato — la implementación concreta
 * (Firebase Realtime Database, un websocket propio, otro servicio) es un
 * adaptador en `infrastructure/` que se inyecta en el composition root.
 */
export interface RoomsGateway {
  /**
   * Crea una sala en estado "waiting" con el snapshot inicial; devuelve su
   * id y la credencial del host (necesaria para reanudar tras reconexión).
   */
  createRoom(initial: GameSnapshot): Promise<CreatedRoom>;

  /**
   * Se une a una sala que está "waiting" y no expirada (pasa a "playing").
   * Devuelve el record resultante — incluye el snapshot autoritativo — o
   * null si la sala no existe, ya no acepta jugadores o está vencida.
   */
  joinRoom(roomId: string): Promise<RoomRecord | null>;

  /**
   * Reanuda el rol de host tras una desconexión transitoria (refresh/cierre
   * sin leave). Devuelve el record, o null si la sala no existe, está
   * cerrada, venció la ventana de gracia o la credencial no coincide.
   */
  resumeRoom(roomId: string, hostToken: string): Promise<RoomRecord | null>;

  /**
   * Marca al host como desconectado sin cerrar la sala: inicia la ventana
   * de reconexión de ROOM_RECONNECT_GRACE_MS.
   */
  disconnectHost(roomId: string): Promise<void>;

  /** Emite el RoomRecord completo en cada cambio; null si la sala no existe. */
  subscribeRoom(
    roomId: string,
    callback: (room: RoomRecord | null) => void,
    onError?: (error: Error) => void,
  ): RoomUnsubscribe;

  /** Emite la lista de salas "waiting" no expiradas en cada cambio. */
  subscribeWaitingRooms(
    callback: (rooms: RoomSummary[]) => void,
    onError?: (error: Error) => void,
  ): RoomUnsubscribe;

  /** Publica el último snapshot del juego en la sala. */
  writeGameState(roomId: string, snapshot: GameSnapshot): Promise<void>;

  /** Abandono explícito: marca la sala como abandonada inmediatamente. */
  leaveRoom(roomId: string): Promise<void>;
}
