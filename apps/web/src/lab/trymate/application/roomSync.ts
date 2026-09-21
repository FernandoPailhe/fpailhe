import type { RoomsGateway } from "../domain/interfaces/RoomsGateway";
import {
  deserializeGameSnapshot,
  serializeGameSnapshot,
  type GameSnapshot,
} from "../domain/entities/GameSnapshot";
import { useGameStore } from "./GameState";

type GameStoreApi = typeof useGameStore;

export interface RoomSyncOptions {
  /**
   * Store a sincronizar; por defecto el singleton `useGameStore`. Los tests
   * pasan stores creados con `createGameStore()` para simular clientes
   * independientes en el mismo proceso.
   */
  store?: GameStoreApi;
  /** Errores de suscripción/escritura del bridge (observables, no tragan). */
  onError?: (error: unknown) => void;
}

const activeSyncs = new Map<GameStoreApi, () => void>();

const defaultOnError = (error: unknown): void => {
  console.error("roomSync error", error);
};

/**
 * JSON canónico de un snapshot: la misma forma que produce `toSnapshot()`.
 * RTDB elimina nulls, arrays vacíos y objetos vacíos al persistir, así que
 * el valor crudo que llega por `onValue` nunca es idéntico al local aunque
 * el estado sea el mismo. Comparar raw JSON hacía que cada write rebotara
 * como "cambio remoto" y `applyRemoteSnapshot` pisara la selección efímera
 * del usuario — los clicks parecían no hacer nada.
 */
function canonicalJson(snapshot: GameSnapshot): string {
  return JSON.stringify(serializeGameSnapshot(deserializeGameSnapshot(snapshot)));
}

/**
 * Bridge useGameStore ↔ RoomsGateway. Push: serializa el snapshot en cada
 * mutación y escribe solo si cambió. Pull: aplica el snapshot remoto si
 * difiere, con flag anti-loop para no re-escribir lo recién aplicado.
 * No conoce el adaptador concreto: recibe el puerto por parámetro.
 *
 * Hay como máximo una sync activa por store: iniciar otra sobre el mismo
 * store reemplaza a la anterior. Devuelve la función de stop del bridge.
 */
export function startRoomSync(
  gateway: RoomsGateway,
  roomId: string,
  options: RoomSyncOptions = {},
): () => void {
  const store = options.store ?? useGameStore;
  const onError = options.onError ?? defaultOnError;

  activeSyncs.get(store)?.();

  let lastSyncedJson = JSON.stringify(store.getState().toSnapshot());
  let applyingRemote = false;

  const unsubRoom = gateway.subscribeRoom(
    roomId,
    (room) => {
      const remote = room?.state;
      if (!remote) return;
      let json: string;
      try {
        json = canonicalJson(remote);
      } catch (error) {
        // Snapshot remoto malformado: no tocar el estado local.
        onError(error);
        return;
      }
      if (json === lastSyncedJson) return;
      lastSyncedJson = json;
      applyingRemote = true;
      try {
        store.getState().applyRemoteSnapshot(remote);
      } catch (error) {
        // Un snapshot malformado no debe tumbar la suscripción de Firebase.
        onError(error);
      } finally {
        applyingRemote = false;
      }
    },
    (error) => onError(error),
  );

  const unsubStore = store.subscribe((state) => {
    if (applyingRemote || !state.roomId) return;
    const snap = state.toSnapshot();
    const json = JSON.stringify(snap);
    if (json === lastSyncedJson) return;
    lastSyncedJson = json;
    gateway.writeGameState(roomId, snap).catch((error) => onError(error));
  });

  const stop = (): void => {
    unsubStore();
    unsubRoom();
    if (activeSyncs.get(store) === stop) activeSyncs.delete(store);
  };

  activeSyncs.set(store, stop);
  return stop;
}

/** Detiene todas las sync activas (la app real solo usa el store singleton). */
export function stopRoomSync(): void {
  activeSyncs.forEach((stop) => stop());
  activeSyncs.clear();
}
