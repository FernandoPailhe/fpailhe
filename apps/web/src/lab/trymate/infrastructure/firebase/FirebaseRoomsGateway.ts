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
import {
  roomAdmitsJoin,
  roomAdmitsResume,
  WAITING_ROOM_MAX_AGE_MS,
  type CreatedRoom,
  type RoomRecord,
  type RoomsGateway,
  type RoomSummary,
  type RoomUnsubscribe,
} from "../../domain/interfaces/RoomsGateway";

const ROOMS_PATH = "rooms";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Error de Realtime Database");
}

/** Credencial opaca del host: solo identifica al navegador que creó la sala. */
function generateHostToken(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `host-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/**
 * Adaptador de `RoomsGateway` sobre Firebase Realtime Database.
 * Único archivo del módulo que conoce el SDK: cambiar de backend es escribir
 * otro adaptador que implemente el mismo puerto.
 *
 * Presencia del host: RTDB no soporta un `onDisconnect` demorado, así que la
 * desconexión escribe `hostConnection:"disconnected"` + `hostDisconnectedAt`
 * (serverTimestamp) y el deadline de resume/join se deriva en lectura con
 * `ROOM_RECONNECT_GRACE_MS`. La sala NO pasa a "abandoned" al caerse.
 */
export class FirebaseRoomsGateway implements RoomsGateway {
  constructor(private readonly db: Database) {}

  private roomRef(roomId: string) {
    return ref(this.db, `${ROOMS_PATH}/${roomId}`);
  }

  /**
   * Registra la presencia del host en esta conexión: al caer el socket, el
   * servidor marca desconectado + timestamp. Hay que re-armarlo tras cada
   * createRoom/resumeRoom porque onDisconnect es por-conexión.
   */
  private async armHostPresence(roomId: string): Promise<void> {
    await onDisconnect(this.roomRef(roomId)).update({
      hostConnection: "disconnected",
      hostDisconnectedAt: serverTimestamp(),
    });
  }

  async createRoom(initial: GameSnapshot): Promise<CreatedRoom> {
    try {
      const roomRef = push(ref(this.db, ROOMS_PATH));
      if (!roomRef.key) throw new Error("No se pudo reservar el id de sala");
      const hostToken = generateHostToken();
      // createdAt/updatedAt son placeholders de serverTimestamp: RTDB los
      // resuelve a number del lado del servidor. expiresAt usa reloj local:
      // es un TTL grueso de 30 min donde el skew de segundos no importa.
      await set(roomRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "waiting",
        guestJoinedAt: null,
        hostConnection: "connected",
        hostDisconnectedAt: null,
        expiresAt: Date.now() + WAITING_ROOM_MAX_AGE_MS,
        hostToken,
        state: initial,
      });
      try {
        await this.armHostPresence(roomRef.key);
      } catch (error) {
        // Sin presencia la sala quedaría colgada: se cierra y se propaga.
        await update(roomRef, { status: "abandoned" }).catch(() => {});
        throw error;
      }
      return { roomId: roomRef.key, hostToken };
    } catch (error) {
      throw toError(error);
    }
  }

  async joinRoom(roomId: string): Promise<RoomRecord | null> {
    try {
      const result = await runTransaction(this.roomRef(roomId), (record: RoomRecord | null) => {
        if (!roomAdmitsJoin(record)) return undefined;
        return {
          ...record,
          status: "playing",
          guestJoinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      });
      if (!result.committed) return null;
      return result.snapshot.val() as RoomRecord;
    } catch (error) {
      throw toError(error);
    }
  }

  async resumeRoom(roomId: string, hostToken: string): Promise<RoomRecord | null> {
    try {
      const result = await runTransaction(this.roomRef(roomId), (record: RoomRecord | null) => {
        if (!roomAdmitsResume(record, hostToken)) return undefined;
        return {
          ...record,
          hostConnection: "connected",
          hostDisconnectedAt: null,
          updatedAt: serverTimestamp(),
        };
      });
      if (!result.committed) return null;
      try {
        await this.armHostPresence(roomId);
      } catch (error) {
        // El resume ya quedó aplicado: degradar presencia no aborta la vuelta.
        console.error("No se pudo rearmar la presencia del host", toError(error));
      }
      return result.snapshot.val() as RoomRecord;
    } catch (error) {
      throw toError(error);
    }
  }

  async disconnectHost(roomId: string): Promise<void> {
    try {
      await update(this.roomRef(roomId), {
        hostConnection: "disconnected",
        hostDisconnectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
        const rooms: RoomSummary[] = Object.entries(value)
          .filter(([, room]) => roomAdmitsJoin(room))
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
    // Abandono explícito e inmediato: primero se cancela el onDisconnect para
    // que no pise el estado final cuando el socket caiga después.
    try {
      await onDisconnect(this.roomRef(roomId)).cancel();
    } catch (error) {
      console.error("No se pudo cancelar el onDisconnect de la sala", toError(error));
    }
    try {
      await update(this.roomRef(roomId), {
        status: "abandoned",
        hostConnection: "disconnected",
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
