import type { GameSnapshot } from "../entities/GameSnapshot";

export type RoomStatus = "waiting" | "playing" | "finished" | "abandoned";

export interface RoomRecord {
  createdAt: number;
  updatedAt: number;
  status: RoomStatus;
  guestJoinedAt: number | null;
  /** Último snapshot del juego publicado en la sala. */
  state: GameSnapshot | null;
}

export interface RoomSummary {
  id: string;
  createdAt: number;
  status: RoomStatus;
}

export type RoomUnsubscribe = () => void;

/**
 * Puerto de persistencia de salas multiplayer. El dominio del juego, los
 * stores y la UI dependen solo de este contrato — la implementación concreta
 * (Firebase Realtime Database, un websocket propio, otro servicio) es un
 * adaptador en `infrastructure/` que se inyecta en el composition root.
 */
export interface RoomsGateway {
  /** Crea una sala en estado "waiting" con el snapshot inicial; devuelve su id. */
  createRoom(initial: GameSnapshot): Promise<string>;

  /**
   * Se une a una sala que está "waiting" (pasa a "playing").
   * Devuelve false si la sala no existe o ya no acepta jugadores.
   */
  joinRoom(roomId: string): Promise<boolean>;

  /** Emite el RoomRecord completo en cada cambio; null si la sala no existe. */
  subscribeRoom(
    roomId: string,
    callback: (room: RoomRecord | null) => void,
    onError?: (error: Error) => void,
  ): RoomUnsubscribe;

  /** Emite la lista de salas disponibles ("waiting") en cada cambio. */
  subscribeWaitingRooms(
    callback: (rooms: RoomSummary[]) => void,
    onError?: (error: Error) => void,
  ): RoomUnsubscribe;

  /** Publica el último snapshot del juego en la sala. */
  writeGameState(roomId: string, snapshot: GameSnapshot): Promise<void>;

  /** Marca la sala como abandonada. */
  leaveRoom(roomId: string): Promise<void>;
}
