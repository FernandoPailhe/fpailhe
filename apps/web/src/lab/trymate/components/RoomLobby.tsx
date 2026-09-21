import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@ferpa/ui";
import { useGameStore } from "../application/GameState";
import { useRoomStore } from "../application/RoomState";
import { GameMode, SetupTurnMode } from "../domain/constants/GameRules";
import { PLAYER_LABEL } from "../lib/gameDisplay";
import { SetupModeSelector } from "./SetupModeSelector";

const SECTION_CLASS = "mx-auto w-full max-w-[420px] border border-line bg-surface px-6 py-5";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  return `${minutes} min ago`;
}

/**
 * Lobby multiplayer: crear sala (con link para compartir), listar salas en
 * espera y unirse. Auto-join cuando la URL trae `?room=<id>`. Si no hay
 * gateway inyectado (multiplayer no configurado) muestra un aviso y el
 * juego local sigue intacto.
 */
export function RoomLobby() {
  const { gateway, status, roomId, role, rooms, error, createRoom, joinRoom, leaveRoom } =
    useRoomStore();
  const localPlayer = useGameStore((s) => s.localPlayer);
  const gameMode = useGameStore((s) => s.gameMode);
  const [copied, setCopied] = useState(false);
  const [quickStart, setQuickStart] = useState(false);
  const [setupTurnMode, setSetupTurnMode] = useState<SetupTurnMode>(SetupTurnMode.ALTERNATING);
  const [params] = useSearchParams();

  // Auto-enter por link compartido: /lab/trymate?room=<id>. Con credencial de
  // host guardada reanuda el rol; si no, entra como guest.
  useEffect(() => {
    const roomParam = params.get("room");
    if (!roomParam || !gateway) return;
    if (useRoomStore.getState().status !== "idle") return;
    void useRoomStore.getState().enterRoom(roomParam);
  }, [params, gateway]);

  // Suscripción al lobby mientras se puede crear/unirse.
  useEffect(() => {
    if (!gateway) return;
    if (status !== "idle" && status !== "error") return;
    return useRoomStore.getState().subscribeLobby();
  }, [gateway, status]);

  if (!gateway) {
    return (
      <section aria-label="Multiplayer" className={SECTION_CLASS}>
        <p className="font-ui text-sm text-ink-dim">
          Online multiplayer is not configured on this deployment — local play only.
        </p>
      </section>
    );
  }

  const shareUrl = roomId ? `${window.location.origin}/lab/trymate?room=${roomId}` : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-label="Multiplayer" className={SECTION_CLASS}>
      {(status === "idle" || status === "error") && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-ui text-sm font-semibold text-ink">Play online</h2>
            <Button
              type="button"
              onClick={() => void createRoom(quickStart ? "quick" : "manual", setupTurnMode)}
            >
              Create a room
            </Button>
          </div>
          <label className="flex items-center gap-2 font-ui text-xs text-ink-dim">
            <input
              type="checkbox"
              checked={quickStart}
              onChange={(e) => setQuickStart(e.target.checked)}
              className={`h-4 w-4 accent-gold ${FOCUS}`}
            />
            Quick start — skip setup, armies placed and ready to play
          </label>
          {!quickStart && <SetupModeSelector value={setupTurnMode} onChange={setSetupTurnMode} />}
          {error && (
            <div className="flex items-center justify-between gap-3" role="alert">
              <p className="font-ui text-xs text-gold-bright">{error}</p>
              <button
                type="button"
                onClick={() => useRoomStore.setState({ status: "idle", error: null })}
                className={`font-ui text-xs text-ink-dim underline underline-offset-2 hover:text-ink ${FOCUS}`}
              >
                Dismiss
              </button>
            </div>
          )}
          <div>
            <h3 className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Open rooms
            </h3>
            {rooms.length === 0 ? (
              <p className="mt-2 font-ui text-xs text-ink-dim">
                No open rooms — create one and share the link.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {rooms.map((room) => (
                  <li
                    key={room.id}
                    className="flex items-center justify-between gap-3 border border-line px-3 py-2"
                  >
                    <span className="min-w-0 truncate font-ui text-xs text-ink">
                      Room {room.id.slice(-6)}
                      <span className="ml-2 text-ink-dim">{relativeTime(room.createdAt)}</span>
                    </span>
                    <Button type="button" onClick={() => void joinRoom(room.id)}>
                      Join
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {(status === "creating" || status === "joining" || status === "resuming") && (
        <p className="font-ui text-sm text-ink-dim" role="status">
          {status === "creating"
            ? "Creating room…"
            : status === "resuming"
              ? "Reconnecting…"
              : "Joining room…"}
        </p>
      )}

      {status === "waiting" && shareUrl && (
        <div className="flex flex-col gap-3">
          <p className="font-ui text-sm text-ink" role="status">
            Waiting for an opponent…
          </p>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={shareUrl}
              aria-label="Room link"
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 border border-line bg-surface-raised px-3 py-1.5 font-ui text-xs text-ink-dim"
            />
            <Button type="button" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => void leaveRoom()}
              className={`font-ui text-xs text-ink-dim underline underline-offset-2 hover:text-ink ${FOCUS}`}
            >
              Cancel room
            </button>
          </div>
        </div>
      )}

      {status === "connected" && (
        <div className="flex items-center justify-between gap-3">
          <p className="font-ui text-sm text-ink">
            Online{role === "host" ? " (host)" : ""} — you play{" "}
            <span className="font-semibold">
              {gameMode === GameMode.ONLINE && localPlayer ? PLAYER_LABEL[localPlayer] : "—"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => void leaveRoom()}
            className={`font-ui text-xs text-ink-dim underline underline-offset-2 hover:text-ink ${FOCUS}`}
          >
            Leave room
          </button>
        </div>
      )}
    </section>
  );
}
