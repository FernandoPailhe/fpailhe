/**
 * Persistencia local de la credencial del host (roomId + hostToken). Vive en
 * `localStorage` para sobrevivir refresh/cierre de pestaña: al volver a
 * `/lab/trymate?room=<id>` el mismo navegador puede reanudar su rol.
 *
 * La credencial es opaca: solo se guarda y se envía a `resumeRoom`. Jamás se
 * incluye en la URL compartida ni se loguea. Si el storage no está disponible
 * (modo privado, políticas, jsdom), se usa un fallback en memoria — el resume
 * solo funciona dentro de la vida de la página y el flujo sigue cayendo al
 * join normal cuando corresponde.
 */

const STORAGE_KEY = "trymate.host-credential";

export interface HostCredential {
  roomId: string;
  hostToken: string;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Fallback de sesión para entornos sin localStorage (tests, modo privado). */
const memoryStorage: KeyValueStorage = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
})();

function storage(): KeyValueStorage | null {
  try {
    const ls = window.localStorage;
    if (!ls) return memoryStorage;
    // Algunos entornos exponen el objeto pero lanzan al usarlo.
    const probe = "__trymate_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage;
  }
}

export function saveHostCredential(credential: HostCredential): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(credential));
  } catch {
    // Storage lleno o bloqueado: el resume simplemente no estará disponible.
  }
}

/** Devuelve la credencial guardada solo si corresponde a la sala pedida. */
export function loadHostCredential(roomId: string): HostCredential | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HostCredential>;
    if (parsed.roomId !== roomId || typeof parsed.hostToken !== "string") return null;
    return { roomId: parsed.roomId, hostToken: parsed.hostToken };
  } catch {
    return null;
  }
}

/**
 * Borra la credencial. Si se pasa roomId, solo la borra cuando coincide con
 * la sala almacenada (evita pisar la credencial de otra sala activa).
 */
export function clearHostCredential(roomId?: string): void {
  try {
    if (roomId !== undefined && loadHostCredential(roomId) === null) return;
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignorado: no hay nada que limpiar.
  }
}
