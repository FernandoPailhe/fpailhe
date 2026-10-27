import { readJson, writeJson } from "./storage";

const KEY = "universes:local-user-id";
let cached: string | undefined;

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* cae al generador propio */
  }
  const rand = () => Math.random().toString(36).slice(2);
  return `usr_${rand()}${rand()}`;
}

/** Id local del jugador: estable entre llamadas y entre recargas. */
export function getLocalUserId(): string {
  if (cached) return cached;
  const existing = readJson<string>(KEY);
  if (typeof existing === "string" && existing) {
    cached = existing;
    return existing;
  }
  const id = makeId();
  writeJson(KEY, id);
  cached = id;
  return id;
}
