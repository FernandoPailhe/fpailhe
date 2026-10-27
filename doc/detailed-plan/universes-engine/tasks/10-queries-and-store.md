# Task 10: Queries (TanStack Query) y store de la partida

> Parte del plan: `../plan.md` — ver "Decisiones de Arquitectura" #8, "Lógica Derivada" y "Contrato para la UI".

## Skill / Capa

`add-query` + `add-store` (`.devin/skills/`). Regla del repo: Zustand es último recurso; la justificación está en la decisión #8 del plan (estado de cliente que debe sobrevivir a re-renders y a la navegación entre `/:slug`, `/jugar` y `/final`).

## Objetivo

Exponer la lista de universos, el contenido de un universo y la sesión guardada como queries, y crear el store que sostiene la partida en curso y el último resultado para que la UI lo derive.

## Depende De

- Task 06 (`listUniverses`, `loadGameContent`, repositorios) y Task 09 (`getUniverseRepositories`, `getLocalUserId`).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/application/keys.ts` — crear
- `apps/web/src/lab/universes/application/useUniverses.ts` — crear (query de la lista)
- `apps/web/src/lab/universes/application/useUniverseContentQuery.ts` — crear
- `apps/web/src/lab/universes/application/useSavedSessionQuery.ts` — crear
- `apps/web/src/lab/universes/application/store/sessionStore.ts` — crear
- `apps/web/src/lab/universes/application/store/sessionStore.test.ts` — crear
- `apps/web/src/lab/universes/application/keys.test.ts` — crear

## Detalles de Implementación

1. **`keys.ts`**: `universeKeys = { all: ["universes"] as const, list: () => [...all, "list"], content: (slug) => [...all, "content", slug], saved: (userId, gameId) => [...all, "saved", userId, gameId] }`.
2. **`useUniverses()`**: `queryFn` ⇒ `listUniverses()`; `staleTime: Infinity`; devuelve `UniverseEntry[]` (slug + `Game`).
3. **`useUniverseContentQuery(slug)`**: `queryFn` ⇒ `loadGameContent(repos.content, repos.cards, slug)`. `staleTime: Infinity`, `gcTime: Infinity`, `retry: false` ante `UnknownUniverseError`.
4. **`useSavedSessionQuery(userId, gameId)`**: `repos.sessions.load(...)`. `staleTime: Infinity`, `refetchOnWindowFocus: false`. Solo sirve para **hidratar** el store una vez; después manda el store.
5. **Store** `useSessionStore` (Zustand, **sin** middleware `persist`; la persistencia la hace el hook de dominio llamando a `SessionRepository.save` tras cada transición). Como el módulo sirve varios universos, el estado se indexa por `slug`:
   ```ts
   export interface LastResolution {
     cardId: ID; optionId: ID;
     events: GameEvent[];                  // del ResolveResult
     parametersBefore: Record<ID, number>; // para calcular delta en ParameterView
     feedbackSent: boolean;
   }
   interface UniverseSlot {
     session: GameSession | null;
     hydrated: boolean;                    // ya se intentó cargar la guardada
     lastResolution: LastResolution | null;
   }
   interface SessionState {
     slots: Record<string, UniverseSlot>;  // por slug
     hydrate(slug: string, session: GameSession | null): void;
     setSession(slug: string, session: GameSession): void;
     setResolution(slug: string, r: LastResolution | null): void;
     markFeedbackSent(slug: string): void;
     reset(slug?: string): void;           // sin slug: todo
   }
   ```
   Comentario de 3 líneas en el archivo con la justificación. Selector auxiliar `selectSlot(slug)` que devuelve un slot vacío estable (constante) si no existe, para no provocar re-renders. No guardar contenido en el store.
6. Ningún archivo de este task importa componentes.

## Fuera de Alcance

- Orquestación del turno y fases (Task 11).
- Estadísticas de cartas (`CardStats`) — el motor recibe `{}`.
- Prefetch en SSR.

## Verificación

- [ ] Tests del store: `hydrate`/`setSession`/`setResolution`/`markFeedbackSent`/`reset(slug)`/`reset()`; slots independientes por slug; aislamiento entre tests (`reset()` en `beforeEach`); el selector devuelve la misma referencia para slots vacíos.
- [ ] Test de `universeKeys` (estables y distintas por argumento).
- [ ] `pnpm vitest run --project web src/lab/universes/application`, `pnpm typecheck`, `pnpm lint`.

## Handoff

Produce: `useUniverses`, `useUniverseContentQuery`, `useSavedSessionQuery`, `universeKeys`, `useSessionStore`, el tipo `LastResolution`. Task 11 los compone en `useNarrativeGame`.
