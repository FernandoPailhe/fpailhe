# Task 09: Persistencia local, identidad y fábrica de repositorios

> Parte del plan: `../plan.md` — ver "Decisiones de Arquitectura" #8 y #10; "Fuente de Datos" (claves de `localStorage`) y los puertos `SessionRepository` y `FeedbackRepository` en "Contrato del motor".

## Skill / Capa

`add-query` (capa de acceso a datos = `infrastructure/`). Regla: **ninguna API del navegador a nivel de módulo** (SSR/prerender de otras rutas importa estos archivos).

## Objetivo

Implementar el almacenamiento seguro, la identidad local, el `SessionRepository` sobre `localStorage`, un `FeedbackRepository` no-op y una fábrica memoizada que el resto del módulo consume.

## Depende De

- Task 01 (tipos, `NARRATIVES_SCHEMA_VERSION`, puertos en `domain/repositories.ts`).
- Task 06 (`errors.ts`, repositorios de contenido que la fábrica compone).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/infrastructure/storage.ts` — crear
- `apps/web/src/lab/universes/infrastructure/identity.ts` — crear
- `apps/web/src/lab/universes/infrastructure/localSessions.ts` — crear
- `apps/web/src/lab/universes/infrastructure/offlineRepositories.ts` — crear
- `apps/web/src/lab/universes/infrastructure/repositories.ts` — crear (fábrica)
- `apps/web/src/lab/universes/infrastructure/index.ts` — editar (exportar)
- `apps/web/src/lab/universes/infrastructure/{storage,identity,localSessions,repositories}.test.ts` — crear

## Detalles de Implementación

1. **`storage.ts`**: `readJson<T>(key): T | undefined`, `writeJson(key, value): boolean`, `removeKey(key): void`. Todo con `try/catch`; `typeof window === "undefined"` o un `localStorage` que lanza ⇒ fallback a un `Map` en memoria del módulo. **Nunca lanza.**
2. **`identity.ts`**: `getLocalUserId(): string` — lee/crea `universes:local-user-id` (uuid vía `crypto.randomUUID()` si existe; si no, un generador propio con `Math.random`). Este archivo está **fuera del motor** y por eso puede usarlo. Estable entre recargas.
3. **`localSessions.ts`** (`SessionRepository`): clave `universes:session:{userId}:{gameId}`, valor `{ v: 1, session }`.
   - `load` ⇒ `null` si no existe, si `v !== 1` o si `session.schemaVersion !== NARRATIVES_SCHEMA_VERSION` (y en ese caso borra la clave).
   - `save` guarda **también las sesiones terminadas** (`won/lost/abandoned`): el contrato de la UI exige que la partida terminada quede guardada hasta `startNewGame()`.
   - `clear` borra la clave.
4. **`offlineRepositories.ts`**: `createOfflineFeedbackRepository(): FeedbackRepository` — `submitFeedback` y `recordImpression` resuelven sin hacer nada.
5. **`repositories.ts`**: `getUniverseRepositories(): UniverseRepositories` (`{ content, cards, feedback, sessions }`), **memoizada**, sin efectos al importar. `content`/`cards` vienen del Task 06. Para agregar Firebase más adelante, la rama va **dentro de esta fábrica** (plan `universes-community`).

## Fuera de Alcance

- TanStack Query (Task 10) y UI.
- Sincronizar sesiones entre dispositivos; varias sesiones por universo.
- Firebase, auth.

## Verificación

- [ ] Tests con `localStorage` simulado y también **sin** `window`: round-trip de sesión (activa y terminada); `v` o `schemaVersion` distinto ⇒ `null` y clave borrada; `localStorage` que lanza ⇒ cae a memoria sin lanzar; `getLocalUserId` estable entre llamadas; claves con el prefijo `universes:`.
- [ ] Importar `infrastructure/index.ts` desde Node sin `window` no lanza.
- [ ] `pnpm vitest run --project web src/lab/universes/infrastructure`, `pnpm typecheck`, `pnpm lint`.

## Handoff

Produce: `getUniverseRepositories()`, `getLocalUserId()`, `SessionRepository` local, `FeedbackRepository` no-op. Task 10 los envuelve en queries y store.
