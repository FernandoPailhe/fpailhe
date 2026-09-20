# TryMate — Setup de Multiplayer (Firebase Realtime Database)

El multiplayer de `/lab/trymate` usa Firebase Realtime Database desde el
cliente (el sitio es estático en Cloudflare, sin backend propio). Sin las
variables configuradas, la app no se rompe: el módulo avisa
"Online multiplayer is not configured" y sigue funcionando en modo local.

## Variables a configurar

Todas se obtienen en **Firebase Console → Project settings → Your apps →
Web app → SDK setup and configuration** (objeto `firebaseConfig`).

| Variable                            | Qué es                                                                           | De dónde sale                                   |
| ----------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | `apiKey`                                                                         | Web app config                                  |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `authDomain` (suele ser `<projectId>.firebaseapp.com`)                           | Web app config                                  |
| `VITE_FIREBASE_PROJECT_ID`          | `projectId`                                                                      | Web app config / General                        |
| `VITE_FIREBASE_DATABASE_URL`        | `databaseURL` (`https://<projectId>-default-rtdb.<region>.firebasedatabase.app`) | Realtime Database → Data (URL arriba del árbol) |
| `VITE_FIREBASE_APP_ID`              | `appId`                                                                          | Web app config                                  |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` (opcional, no necesaria para RTDB)                           | Web app config                                  |
| `VITE_FIREBASE_STORAGE_BUCKET`      | `storageBucket` (opcional, idem)                                                 | Web app config                                  |

Las cinco primeras son requeridas: si falta **cualquiera**, el módulo se
comporta como "no configurado" (modo local). Las referencias están en
`apps/web/src/lab/trymate/infrastructure/firebase/firebaseClient.ts` y
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

## Ciclo de vida de una sala

Cada `rooms/<roomId>` guarda un `RoomRecord`:

| Campo                                   | Tipo                                       | Qué es                                                     |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `status`                                | `waiting`/`playing`/`finished`/`abandoned` | Estado de la sala                                          |
| `state`                                 | snapshot del juego                         | Último estado autoritativo sincronizado                    |
| `createdAt`/`updatedAt`/`guestJoinedAt` | serverTimestamp                            | Tiempos del ciclo de vida                                  |
| `expiresAt`                             | number                                     | TTL de la sala en `waiting` (creada + 30 min)              |
| `hostConnection`                        | `connected`/`disconnected`                 | Presencia del host                                         |
| `hostDisconnectedAt`                    | number \| null                             | Última caída del host (serverTimestamp via `onDisconnect`) |
| `hostToken`                             | string                                     | Credencial opaca para reanudar el rol host                 |

### Reconexión del host (ventana de gracia de 30 s)

RTDB **no soporta un `onDisconnect` demorado**: la operación se ejecuta en el
servidor apenas cae el socket. Por eso el disconnect ya no escribe
`status: "abandoned"` — escribe `hostConnection: "disconnected"` +
`hostDisconnectedAt` (timestamp del servidor) y deja la sala viva. El deadline
efectivo se deriva en lectura:

- **waiting**: `min(expiresAt, hostDisconnectedAt + 30 s)`.
- **playing**: `hostDisconnectedAt + 30 s` (si el host figura conectado no
  hay deadline — la credencial es la autorización, y cubre la carrera en que
  el `onDisconnect` del socket viejo todavía no llegó al servidor).

El mismo navegador reanuda con `resumeRoom(roomId, hostToken)` — la
credencial se persiste en `localStorage` al crear la sala (nunca viaja en el
link ni aparece en `RoomSummary`). Sin credencial, el link entra como guest.

Los abandonos explícitos ("Cancel room", "Leave room", "Back to menu")
siguen cerrando la sala de inmediato (`status: "abandoned"` + cancelación del
`onDisconnect`).

### Expiración y limpieza

No hay borrado físico ni tarea programada: los registros expirados pueden
quedar almacenados. Las salas vencidas se ocultan del lobby
(`subscribeWaitingRooms` filtra por el deadline) y `joinRoom`/`resumeRoom`
las rechazan transaccionalmente. Si el volumen crece, una Cloud Function
programada de limpieza es el follow-up natural.

### Costos

Mantener la sala ~30 s extra es mínimo para el volumen de este lab: el
registro ocupa pocos KB y el costo real viene de listeners conectados y
writes de snapshots, no del almacenamiento. No es costo cero — Firebase
factura según plan y uso real; monitorear el panel de uso.

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

Validación de shape sugerida si se endurece (tipos de los campos nuevos —
no pegar tokens reales en reglas ni reglas que los logueen):

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      "$roomId": {
        ".write": true,
        ".validate": "newData.hasChildren(['status', 'hostToken'])",
        "hostConnection": {
          ".validate": "newData.val() == 'connected' || newData.val() == 'disconnected'"
        },
        "status": { ".validate": "newData.isString()" }
      }
    }
  }
}
```

Riesgo conocido: escritura abierta — cualquiera con la config pública puede
crear/cerrar salas. Mitigaciones de cortesía ya implementadas: el lobby solo
lista salas `waiting` dentro de su deadline, y `joinRoom`/`resumeRoom` son
transacciones que validan status, expiración y credencial atómicamente.
Si se quiere restringir de verdad: Firebase Auth (anónima) + App Check
(trabajo separado, fuera del alcance actual).

## Comportamiento sin configurar

`firebaseClient.isMultiplayerConfigured()` devuelve `false` si falta alguna
variable → `createFirebaseRoomsGateway()` devuelve `null` → el lobby muestra
el aviso y el modo local (hot-seat PVP) funciona igual que siempre.

## Compartir sala

El link es `/lab/trymate?room=<roomId>` — query param, no path, porque el
hosting es estático con 404 real para rutas desconocidas. Quien abre el link
entra como guest (Black) salvo que el navegador tenga la credencial de host
de esa sala — en ese caso reanuda el rol host si está dentro de la ventana
de gracia. El `hostToken` **nunca** va en la URL.
