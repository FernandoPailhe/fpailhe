/**
 * Almacenamiento seguro: `localStorage` si existe y responde; si no,
 * un `Map` en memoria del módulo. Ninguna función lanza.
 * (SSR/prerender importa estos archivos: nada de browser APIs sin guardar.)
 */
const memoryFallback = new Map<string, string>();

function localStorageOrUndefined(): Storage | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    return window.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

export function readJson<T>(key: string): T | undefined {
  let raw: string | null | undefined;
  try {
    raw = localStorageOrUndefined()?.getItem(key);
  } catch {
    raw = undefined;
  }
  if (raw == null) raw = memoryFallback.get(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Devuelve `false` si el valor solo quedó en el espejo en memoria. */
export function writeJson(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  try {
    const ls = localStorageOrUndefined();
    if (ls) {
      ls.setItem(key, raw);
      memoryFallback.delete(key); // evita divergencia con el espejo
      return true;
    }
  } catch {
    /* localStorage no disponible, lleno o bloqueado */
  }
  memoryFallback.set(key, raw);
  return false;
}

export function removeKey(key: string): void {
  try {
    localStorageOrUndefined()?.removeItem(key);
  } catch {
    /* ignore */
  }
  memoryFallback.delete(key);
}
