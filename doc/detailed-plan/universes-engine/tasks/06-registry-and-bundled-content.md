# Task 06: Registro de universos y carga perezosa del contenido embebido

> Parte del plan: `../plan.md` — ver "Decisiones de Arquitectura" #4, #5, #10; "Fuente de Datos"; "Publicación de universos"; y los puertos de repositorio en "Contrato del motor".

## Skill / Capa

`add-query` (capa de acceso a datos; acá es `infrastructure/`). Regla: sin browser APIs a nivel de módulo (el prerender y el SSR no deben fallar al importar estos archivos).

## Objetivo

Descubrir los universos disponibles, cargar el contenido de uno perezosamente (un chunk por universo) y exponerlo a través de los puertos `GameContentRepository` y `CardRepository`. Los puertos (tipos) ya existen en `domain/repositories.ts` (Task 01).

## Depende De

- Task 01 (tipos, `RawGameBundle`).
- Task 05 (`assembleGameContent`).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/infrastructure/errors.ts` — crear
- `apps/web/src/lab/universes/infrastructure/registry.ts` — crear
- `apps/web/src/lab/universes/infrastructure/bundledContent.ts` — crear
- `apps/web/src/lab/universes/infrastructure/index.ts` — crear (barrel)
- `apps/web/src/lab/universes/infrastructure/registry.test.ts`, `bundledContent.test.ts` — crear

## Detalles de Implementación

1. **Puertos** (`domain/repositories.ts`, ya creado): `GameContentRepository.getGameBySlug(slug)` y los demás getters reciben `gameId`. La implementación mantiene un mapa `gameId → slug` poblado por `getGameBySlug`/`loadRawBundle`. No cambiar firmas.
2. **`errors.ts`**: `UnknownUniverseError` (extiende `Error`, `name = "UnknownUniverseError"`, guarda `slug`). `NotAvailableError`.
3. **`registry.ts`** — descubrimiento (funciones; **nada ejecutable a nivel de módulo salvo los `import.meta.glob`**, que son estáticos):
   ```ts
   const gameModules = import.meta.glob("../content/*/game.json", { import: "default" });
   // Solo en desarrollo y tests: incluye el universo de pruebas.
   const fixtureGameModules = import.meta.env.DEV || import.meta.env.MODE === "test"
     ? import.meta.glob("../testing/fixtures/*/game.json", { import: "default" })
     : {};
   ```
   - Nota de build: `import.meta.env.DEV`/`MODE` se reemplazan en tiempo de build; en producción `fixtureGameModules` queda `{}` y los fixtures **no** entran al bundle. Verificarlo en el task 13 (`grep -r demo-reino apps/web/dist` vacío).
   - `export interface UniverseEntry { slug: string; basePath: "content" | "fixture"; game: Game }`.
   - `export async function listUniverses(opts?: { includeUnpublished?: boolean }): Promise<UniverseEntry[]>`: carga **solo** los `game.json` (liviano), los mapea por `slug` (el `slug` sale de la **carpeta**, y se exige que coincida con `game.slug`; si no coincide, se omite y se hace `console.warn` solo en DEV). Filtra `game.status === "published"` salvo que `includeUnpublished` sea `true`; el valor por defecto de `includeUnpublished` es `import.meta.env.DEV`. Orden alfabético por `game.title.default`.
   - `export async function findUniverse(slug: string): Promise<UniverseEntry | undefined>`.
4. **`bundledContent.ts`**:
   - `createBundledGameContentRepository(): GameContentRepository` y `createBundledCardRepository(): CardRepository`.
   - Carga **perezosa y memoizada por slug**: `loadRawBundle(slug)` resuelve la carpeta (`content` o `fixture`) y hace un `import()` por archivo vía los `import.meta.glob` **sin `eager`** (`../content/*/*.json`, `../content/*/cards/*.json` y los equivalentes de fixtures bajo la misma regla DEV/test), filtra las claves del slug pedido, y arma el `RawGameBundle` con `Promise.all`. Un único cast documentado en el borde: `as unknown as RawGameBundle` (los JSON no pueden comprobarse con `satisfies`).
   - Los archivos opcionales ausentes (`branches.json`, `characters.json`, `powers.json`, `badges.json`, `icons.json`, `assets.json`, `aesthetic.json`) se tratan como `[]` / `undefined`. Faltan `game.json`, `stages.json` o `parameters.json` ⇒ `UnknownUniverseError`.
   - Cada getter del puerto lee del bundle memoizado. `getCardCounters` ⇒ `[]` (sin estadísticas en este plan).
   - `export async function loadGameContent(repo: GameContentRepository, cards: CardRepository, slug: string): Promise<GameContent>`: arma `assembleGameContent` con los getters; lanza `UnknownUniverseError` si el juego no existe **o no está publicado y no es DEV/test**. **No valida** (la validación es del build, task 08).
5. Ningún archivo de `infrastructure/` importa React, Zustand ni componentes.

## Fuera de Alcance

- Persistencia de partidas e identidad (Task 09), TanStack Query (Task 10), UI.
- Validar contenido (Task 05 lo implementa; Task 08 lo ejecuta en el build).
- Cartas de usuarios.

## Verificación

- [ ] Tests (`pnpm vitest run --project web src/lab/universes/infrastructure`): `listUniverses({includeUnpublished:true})` incluye `demo-reino` (requiere Task 07; hasta entonces el test se escribe con `it.todo` o se completa al terminar el 07); `findUniverse("no-existe")` ⇒ `undefined`; `loadGameContent` con slug desconocido ⇒ `UnknownUniverseError`; memoización (dos cargas ⇒ un solo `import`); archivos opcionales ausentes ⇒ listas vacías.
- [ ] Test: el número de cartas `published` que devuelve `loadGameContent(..., "demo-reino")` es igual al de los JSON del fixture, y `validateGameContent` no da errores.
- [ ] `pnpm typecheck`, `pnpm lint`.
- [ ] `pnpm build`: importar estos módulos en Node (prerender) no falla; en `dist/assets` los JSON del universo quedan en chunks separados del bundle inicial.

## Handoff

Produce: `listUniverses`, `findUniverse`, `createBundledGameContentRepository`, `createBundledCardRepository`, `loadGameContent`, `UnknownUniverseError`, Task 08 usa `listUniverses` para validar todos los universos; Task 10 los envuelve en queries.
