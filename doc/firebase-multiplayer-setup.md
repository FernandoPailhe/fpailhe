# Rugby Chess — Setup de Multiplayer (Firebase Realtime Database)

El multiplayer de `/lab/rugby-chess` usa Firebase Realtime Database desde el
cliente (el sitio es estático en Cloudflare, sin backend propio). Sin las
variables configuradas, la app no se rompe: el módulo avisa
"Online multiplayer is not configured" y sigue funcionando en modo local.

## Variables a configurar

Todas se obtienen en **Firebase Console → Project settings → Your apps →
Web app → SDK setup and configuration** (objeto `firebaseConfig`).

| Variable | Qué es | De dónde sale |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` | Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` (suele ser `<projectId>.firebaseapp.com`) | Web app config |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` | Web app config / General |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL` (`https://<projectId>-default-rtdb.<region>.firebasedatabase.app`) | Realtime Database → Data (URL arriba del árbol) |
| `VITE_FIREBASE_APP_ID` | `appId` | Web app config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` (opcional, no necesaria para RTDB) | Web app config |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` (opcional, idem) | Web app config |

Las cinco primeras son requeridas: si falta **cualquiera**, el módulo se
comporta como "no configurado" (modo local). Las referencias están en
`apps/web/src/lab/rugby-chess/infrastructure/firebase/firebaseClient.ts` y
listadas con valores vacíos en `apps/web/.env.example`.

## Pasos en Firebase Console

1. Crear un proyecto (o usar uno existente).
2. **Build → Realtime Database → Create Database**: elegir región y arrancar
   en modo locked; ajustar las reglas después (abajo).
3. **Project settings → Add app (Web)**: registrar la app y copiar los campos
   de la config a las variables de arriba.

## Dónde van las variables

- **Desarrollo local**: `apps/web/.env.local` (gitignored — no commitear).
- **Deploy (Cloudflare Pages/Workers)**: Settings → Environment variables del
  sitio. Vite las embebe **en build time** — cambiar una variable requiere
  rebuild/redeploy, no son runtime.

## Reglas de Realtime Database sugeridas

Acceso anónimo deliberado para este lab (sin Firebase Auth):

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    }
  }
}
```

Riesgo conocido: escritura abierta — cualquiera con la config pública puede
crear/cerrar salas. Mitigaciones de cortesía ya implementadas: el lobby solo
lista salas `waiting` de menos de 30 minutos, y `joinRoom` es una transacción
que solo admite salas en `waiting`. Si se quiere restringir de verdad:
Firebase Auth (anónima) + validación de shape en las rules + App Check.

## Comportamiento sin configurar

`firebaseClient.isMultiplayerConfigured()` devuelve `false` si falta alguna
variable → `createFirebaseRoomsGateway()` devuelve `null` → el lobby muestra
el aviso y el modo local (hot-seat PVP) funciona igual que siempre.

## Compartir sala

El link es `/lab/rugby-chess?room=<roomId>` — query param, no path, porque el
hosting es estático con 404 real para rutas desconocidas. Quien abre el link
entra directo a la sala como Black (el host siempre es White).
