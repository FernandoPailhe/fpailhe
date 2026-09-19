import type { RoomsGateway } from "../domain/interfaces/RoomsGateway";
import { useGameStore } from "./GameState";

let unsubStore: (() => void) | null = null;
let unsubRoom: (() => void) | null = null;
let lastSyncedJson = "";
let applyingRemote = false;

/**
 * Bridge useGameStore ↔ RoomsGateway. Push: serializa el snapshot en cada
 * mutación y escribe solo si cambió. Pull: aplica el snapshot remoto si
 * difiere, con flag anti-loop para no re-escribir lo recién aplicado.
 * No conoce el adaptador concreto: recibe el puerto por parámetro.
 */
export function startRoomSync(gateway: RoomsGateway, roomId: string): void {
  stopRoomSync();
  lastSyncedJson = JSON.stringify(useGameStore.getState().toSnapshot());

  unsubRoom = gateway.subscribeRoom(roomId, (room) => {
    const remote = room?.state;
    if (!remote) return;
    const json = JSON.stringify(remote);
    if (json === lastSyncedJson) return;
    lastSyncedJson = json;
    applyingRemote = true;
    try {
      useGameStore.getState().applyRemoteSnapshot(remote);
    } finally {
      applyingRemote = false;
    }
  });

  unsubStore = useGameStore.subscribe((state) => {
    if (applyingRemote || !state.roomId) return;
    const snap = state.toSnapshot();
    const json = JSON.stringify(snap);
    if (json === lastSyncedJson) return;
    lastSyncedJson = json;
    void gateway.writeGameState(roomId, snap);
  });
}

export function stopRoomSync(): void {
  unsubStore?.();
  unsubRoom?.();
  unsubStore = null;
  unsubRoom = null;
  lastSyncedJson = "";
}
