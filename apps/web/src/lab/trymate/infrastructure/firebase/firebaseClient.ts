import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_APP_ID",
] as const;

/** true solo si están TODAS las variables requeridas (valores no vacíos). */
export function isMultiplayerConfigured(): boolean {
  return REQUIRED_ENV.every((key) => Boolean(import.meta.env[key]));
}

/**
 * Devuelve la Database o null si el multiplayer no está configurado.
 * Jamás lanza: la app debe seguir funcionando en modo local.
 */
export function getFirebaseDb(): Database | null {
  if (!isMultiplayerConfigured()) return null;
  try {
    const app: FirebaseApp =
      getApps()[0] ??
      initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      });
    return getDatabase(app);
  } catch {
    return null;
  }
}
