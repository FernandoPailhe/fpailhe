import { NARRATIVES_SCHEMA_VERSION } from "../domain/constants";
import type { GameSession, ID } from "../domain/models";
import type { SessionRepository } from "../domain/repositories";
import { readJson, removeKey, writeJson } from "./storage";

const PREFIX = "universes:session:";
const STORAGE_VERSION = 1;

interface StoredSession {
  v: number;
  session: GameSession;
}

function keyOf(userId: ID, gameId: ID): string {
  return `${PREFIX}${userId}:${gameId}`;
}

/** Sesiones sobre `localStorage` (una partida por usuario×universo). */
export function createLocalSessionRepository(): SessionRepository {
  return {
    async load(userId, gameId) {
      const k = keyOf(userId, gameId);
      const stored = readJson<StoredSession>(k);
      if (!stored) return null;
      if (stored.v !== STORAGE_VERSION || stored.session?.schemaVersion !== NARRATIVES_SCHEMA_VERSION) {
        removeKey(k);
        return null;
      }
      return stored.session;
    },
    // Guarda también sesiones terminadas: la UI las muestra hasta startNewGame().
    async save(session) {
      writeJson(keyOf(session.userId, session.gameId), { v: STORAGE_VERSION, session });
    },
    async clear(userId, gameId) {
      removeKey(keyOf(userId, gameId));
    },
  };
}
