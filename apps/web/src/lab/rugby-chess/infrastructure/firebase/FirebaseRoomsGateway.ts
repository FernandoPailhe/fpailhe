import {
  ref,
  push,
  set,
  update,
  onValue,
  runTransaction,
  serverTimestamp,
  onDisconnect,
  query,
  orderByChild,
  equalTo,
  type Database,
} from "firebase/database";
import { getFirebaseDb } from "./firebaseClient";
import type { GameSnapshot } from "../../domain/entities/GameSnapshot";
import type {
  RoomRecord,
  RoomsGateway,
  RoomSummary,
  RoomUnsubscribe,
} from "../../domain/interfaces/RoomsGateway";

const ROOMS_PATH = "rooms";
const WAITING_ROOM_MAX_AGE_MS = 30 * 60 * 1000;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Error de Realtime Database");
}

/**
 * Adaptador de `RoomsGateway` sobre Firebase Realtime Database.
 * Único archivo del módulo que conoce el SDK: cambiar de backend es escribir
 * otro adaptador que implemente el mismo puerto.
 */
export class FirebaseRoomsGateway implements RoomsGateway {
  constructor(private readonly db: Database) {}

  private roomRef(roomId: string) {
    return ref(this.db, `${ROOMS_PATH}/${roomId}`);
  }

  async createRoom(initial: GameSnapshot): Promise<string> {
    try {
      const roomRef = push(ref(this.db, ROOMS_PATH));
      if (!roomRef.key) throw new Error("No se pudo reservar el id de sala");
      // createdAt/updatedAt son placeholders de serverTimestamp: RTDB los
      // resuelve a number del lado del servidor.
      await set(roomRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "waiting",
        guestJoinedAt: null,
        state: initial,
      });
      void onDisconnect(roomRef).update({ status: "abandoned" });
      return roomRef.key;
    } catch (error) {
      throw toError(error);
    }
  }

  async joinRoom(roomId: string): Promise<boolean> {
    try {
      const result = await runTransaction(this.roomRef(roomId), (record: RoomRecord | null) => {
        if (!record || record.status !== "waiting") return undefined;
        return { ...record, status: "playing", guestJoinedAt: Date.now() };
      });
      return result.committed;
    } catch (error) {
      throw toError(error);
    }
  }

  subscribeRoom(
    roomId: string,
    callback: (room: RoomRecord | null) => void,
    onError?: (error: Error) => void,
  ): RoomUnsubscribe {
    return onValue(
      this.roomRef(roomId),
      (snapshot) => callback((snapshot.val() as RoomRecord | null) ?? null),
      (error) => onError?.(toError(error)),
    );
  }

  subscribeWaitingRooms(
    callback: (rooms: RoomSummary[]) => void,
    onError?: (error: Error) => void,
  ): RoomUnsubscribe {
    const waitingQuery = query(
      ref(this.db, ROOMS_PATH),
      orderByChild("status"),
      equalTo("waiting"),
    );
    return onValue(
      waitingQuery,
      (snapshot) => {
        const value = (snapshot.val() as Record<string, RoomRecord> | null) ?? {};
        const cutoff = Date.now() - WAITING_ROOM_MAX_AGE_MS;
        const rooms: RoomSummary[] = Object.entries(value)
          .filter(([, room]) => typeof room.createdAt === "number" && room.createdAt >= cutoff)
          .map(([id, room]) => ({ id, createdAt: room.createdAt, status: room.status }));
        callback(rooms);
      },
      (error) => onError?.(toError(error)),
    );
  }

  async writeGameState(roomId: string, snapshot: GameSnapshot): Promise<void> {
    try {
      await update(this.roomRef(roomId), {
        state: snapshot,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw toError(error);
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    try {
      await update(this.roomRef(roomId), {
        status: "abandoned",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw toError(error);
    }
  }
}

/**
 * Factoría usada por el composition root: devuelve null cuando el multiplayer
 * no está configurado (faltan VITE_FIREBASE_*), nunca lanza.
 */
export function createFirebaseRoomsGateway(): RoomsGateway | null {
  const db = getFirebaseDb();
  return db ? new FirebaseRoomsGateway(db) : null;
}
