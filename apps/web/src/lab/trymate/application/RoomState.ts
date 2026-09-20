import { create } from "zustand";
import { Player } from "../domain/constants/PieceConstants";
import type { RoomSetupMode } from "../domain/constants/GameRules";
import {
  roomAdmissionDeadline,
  type RoomRecord,
  type RoomsGateway,
  type RoomSummary,
  type RoomUnsubscribe,
} from "../domain/interfaces/RoomsGateway";
import { useGameStore } from "./GameState";
import { startRoomSync, stopRoomSync } from "./roomSync";
import { clearHostCredential, loadHostCredential, saveHostCredential } from "./hostCredential";

export type RoomRole = "host" | "guest";

export type RoomConnectionStatus =
  "idle" | "creating" | "waiting" | "joining" | "resuming" | "connected" | "error";

interface RoomStore {
  /** Puerto inyectado por el composition root; null = multiplayer no configurado. */
  gateway: RoomsGateway | null;
  status: RoomConnectionStatus;
  roomId: string | null;
  role: RoomRole | null;
  rooms: RoomSummary[];
  error: string | null;

  setGateway: (gateway: RoomsGateway | null) => void;
  createRoom: (setupMode: RoomSetupMode) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  resumeRoom: (roomId: string) => Promise<boolean>;
  /** Entry point del link compartido: resume como host si hay credencial local, si no join como guest. */
  enterRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  subscribeLobby: () => RoomUnsubscribe;
}

let statusUnsub: RoomUnsubscribe | null = null;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error de conexión con la sala";
}

export const useRoomStore = create<RoomStore>((set, get) => {
  const syncError = (error: unknown): void => set({ error: toMessage(error) });

  const teardown = (): void => {
    stopRoomSync();
    statusUnsub?.();
    statusUnsub = null;
  };

  /** Cierre local cuando la sala quedó abandonada o venció su deadline. */
  const closeRoomLocally = (message: string): void => {
    const { roomId } = get();
    if (roomId) clearHostCredential(roomId);
    teardown();
    useGameStore.getState().reset();
    set({ status: "idle", roomId: null, role: null, error: message });
  };

  /** Suscripción paralela que solo mira el ciclo de vida de la sala. */
  const watchRoomStatus = (gateway: RoomsGateway, roomId: string): void => {
    statusUnsub?.();
    statusUnsub = gateway.subscribeRoom(
      roomId,
      (room: RoomRecord | null) => {
        const { status, role } = get();
        if (!room || (status !== "waiting" && status !== "connected")) return;
        if (room.status === "playing" && role === "host") {
          set({ status: "connected" });
        }
        const deadline = roomAdmissionDeadline(room);
        const expired = deadline !== null && Date.now() > deadline;
        if (room.status === "abandoned") {
          closeRoomLocally("The room was closed");
        } else if (expired) {
          closeRoomLocally("The room expired");
        }
      },
      (error) => set({ error: toMessage(error) }),
    );
  };

  /** Orden común tras entrar a una sala: contexto → sync → status → watcher. */
  const activateRoom = (
    gateway: RoomsGateway,
    roomId: string,
    room: RoomRecord,
    role: RoomRole,
    player: Player,
  ): void => {
    // El snapshot remoto autoritativo se aplica ANTES de fijar el contexto
    // online y antes de iniciar el sync: el estado local vacío nunca se
    // publica sobre la sala durante el bootstrap.
    if (room.state) useGameStore.getState().applyRemoteSnapshot(room.state);
    useGameStore.getState().setOnlineContext(roomId, player);
    startRoomSync(gateway, roomId, { onError: syncError });
    set({
      status: room.status === "waiting" ? "waiting" : "connected",
      roomId,
      role,
    });
    watchRoomStatus(gateway, roomId);
  };

  return {
    gateway: null,
    status: "idle",
    roomId: null,
    role: null,
    rooms: [],
    error: null,

    setGateway: (gateway) => set({ gateway }),

    createRoom: async (setupMode) => {
      const { gateway } = get();
      if (!gateway) {
        set({ status: "error", error: "Multiplayer is not configured" });
        return;
      }
      teardown();
      set({ status: "creating", error: null });
      try {
        // Único entry point online: prepara el juego, captura el snapshot y
        // recién entonces crea la sala e inicia la sincronización.
        const game = useGameStore.getState();
        game.prepareOnlineGame(setupMode);
        const snapshot = useGameStore.getState().toSnapshot();
        const { roomId, hostToken } = await gateway.createRoom(snapshot);
        saveHostCredential({ roomId, hostToken });
        useGameStore.getState().setOnlineContext(roomId, Player.BLANCAS);
        startRoomSync(gateway, roomId, { onError: syncError });
        set({ status: "waiting", roomId, role: "host" });
        watchRoomStatus(gateway, roomId);
      } catch (error) {
        set({ status: "error", error: toMessage(error) });
      }
    },

    joinRoom: async (roomId) => {
      const { gateway } = get();
      if (!gateway) {
        set({ status: "error", error: "Multiplayer is not configured" });
        return;
      }
      teardown();
      set({ status: "joining", error: null });
      try {
        const room = await gateway.joinRoom(roomId);
        if (!room) {
          set({ status: "idle", error: "Room is no longer available" });
          return;
        }
        activateRoom(gateway, roomId, room, "guest", Player.NEGRAS);
      } catch (error) {
        set({ status: "error", error: toMessage(error) });
      }
    },

    resumeRoom: async (roomId) => {
      const { gateway } = get();
      const credential = loadHostCredential(roomId);
      if (!gateway || !credential) return false;
      teardown();
      set({ status: "resuming", error: null });
      try {
        const room = await gateway.resumeRoom(roomId, credential.hostToken);
        if (!room) {
          clearHostCredential(roomId);
          set({ status: "idle", error: "The room is no longer available" });
          return false;
        }
        activateRoom(gateway, roomId, room, "host", Player.BLANCAS);
        return true;
      } catch (error) {
        set({ status: "error", error: toMessage(error) });
        return false;
      }
    },

    enterRoom: async (roomId) => {
      // Credencial local de host para esta sala → intento de resume; si no
      // hay credencial o ya no es válida, se entra como guest (NEGRAS).
      if (loadHostCredential(roomId) && (await get().resumeRoom(roomId))) return;
      await get().joinRoom(roomId);
    },

    leaveRoom: async () => {
      const { gateway, roomId } = get();
      if (gateway && roomId) {
        try {
          await gateway.leaveRoom(roomId);
        } catch {
          // best-effort: la sala igualmente queda cerrada localmente
        }
      }
      if (roomId) clearHostCredential(roomId);
      teardown();
      useGameStore.getState().reset();
      set({ status: "idle", roomId: null, role: null, error: null });
    },

    subscribeLobby: () => {
      const { gateway } = get();
      if (!gateway) return () => {};
      return gateway.subscribeWaitingRooms(
        (rooms) => set({ rooms }),
        (error) => set({ error: toMessage(error) }),
      );
    },
  };
});
