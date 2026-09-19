import { create } from "zustand";
import { Player } from "../domain/constants/PieceConstants";
import type {
  RoomRecord,
  RoomsGateway,
  RoomSummary,
  RoomUnsubscribe,
} from "../domain/interfaces/RoomsGateway";
import { useGameStore } from "./GameState";
import { startRoomSync, stopRoomSync } from "./roomSync";

export type RoomRole = "host" | "guest";

export type RoomConnectionStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "joining"
  | "connected"
  | "error";

interface RoomStore {
  /** Puerto inyectado por el composition root; null = multiplayer no configurado. */
  gateway: RoomsGateway | null;
  status: RoomConnectionStatus;
  roomId: string | null;
  role: RoomRole | null;
  rooms: RoomSummary[];
  error: string | null;

  setGateway: (gateway: RoomsGateway | null) => void;
  createRoom: () => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  subscribeLobby: () => RoomUnsubscribe;
}

let statusUnsub: RoomUnsubscribe | null = null;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error de conexión con la sala";
}

export const useRoomStore = create<RoomStore>((set, get) => {
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
        if (room.status === "abandoned") {
          stopRoomSync();
          statusUnsub?.();
          statusUnsub = null;
          useGameStore.getState().reset();
          set({
            status: "idle",
            roomId: null,
            role: null,
            error: "The room was closed",
          });
        }
      },
      (error) => set({ error: toMessage(error) }),
    );
  };

  const teardown = (): void => {
    stopRoomSync();
    statusUnsub?.();
    statusUnsub = null;
  };

  return {
    gateway: null,
    status: "idle",
    roomId: null,
    role: null,
    rooms: [],
    error: null,

    setGateway: (gateway) => set({ gateway }),

    createRoom: async () => {
      const { gateway } = get();
      if (!gateway) {
        set({ status: "error", error: "Multiplayer is not configured" });
        return;
      }
      set({ status: "creating", error: null });
      try {
        const snapshot = useGameStore.getState().toSnapshot();
        const roomId = await gateway.createRoom(snapshot);
        useGameStore.getState().setOnlineContext(roomId, Player.BLANCAS);
        startRoomSync(gateway, roomId);
        set({ status: "waiting", roomId, role: "host" });
        watchRoomStatus(gateway, roomId);
      } catch (error) {
        set({ status: "error", error: toMessage(error) });
      }
    },

    joinRoom: async (roomId: string) => {
      const { gateway } = get();
      if (!gateway) {
        set({ status: "error", error: "Multiplayer is not configured" });
        return;
      }
      set({ status: "joining", error: null });
      try {
        const joined = await gateway.joinRoom(roomId);
        if (!joined) {
          set({ status: "idle", error: "Room is no longer available" });
          return;
        }
        useGameStore.getState().setOnlineContext(roomId, Player.NEGRAS);
        startRoomSync(gateway, roomId);
        set({ status: "connected", roomId, role: "guest" });
        watchRoomStatus(gateway, roomId);
      } catch (error) {
        set({ status: "error", error: toMessage(error) });
      }
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
