# Task 08: Validación de contenido en el build y simulación de partidas

> Parte del plan: `../plan.md` — ver "Decisiones de Arquitectura" #5 y #9, "Publicación de universos" y la tabla "Contenido de prueba".

## Skill / Capa

QA + tooling. Los tests usan el motor real de `domain/engine` y el registro del Task 06.

## Objetivo

1. Un test que valida **todos** los universos de `content/` (y el fixture) con `validateGameContent`; los `published` con `error` **rompen** el build, el resto solo avisa.
2. Un test de simulación que juega partidas con semillas fijas sobre cada universo y comprueba que el juego se puede terminar sin atascarse.
3. Scripts raíz `universes:validate` y el enganche al `build`.

## Depende De

- Task 04 (motor), Task 05 (validación/ensamblado), Task 06 (registro/carga), Task 07 (fixture).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/testing/loadAllBundles.ts` — crear (carga sincrónica de todos los bundles de `content/*` **y** `fixtures/*`)
- `apps/web/src/lab/universes/testing/content.test.ts` — crear
- `apps/web/src/lab/universes/testing/simulation.test.ts` — crear
- `package.json` (raíz) — editar scripts `universes:validate` y `build`

## Detalles de Implementación

1. **`loadAllBundles.ts`**: `import.meta.glob("../content/*/*.json", { eager: true, import: "default" })` y `../content/*/cards/*.json`, más los equivalentes para `./fixtures/*/…`. Devuelve `{ slug, origin: "content" | "fixture", raw: RawGameBundle }[]` agrupando por carpeta (un cast documentado en el borde). Si `content/` está vacío (estado inicial) devuelve solo el fixture.
2. **`content.test.ts`**: para cada bundle: `assembleGameContent(raw)` → `validateGameContent`.
   - Universos con `game.status === "published"`: **0 `error`** (si falla, listar `slug`, `code` y `path` de cada uno).
   - Los demás (`draft`/`in_review`): los `error` se imprimen con `console.warn` pero no fallan.
   - `warning` de cualquier universo ⇒ `console.warn` (informativo).
   - Comprobaciones extra por universo publicado: (a) todo `endingKey` usado en un `end_game` (y `no_cards`) existe en `Game.metadata.endings` (usar `endingFor`); (b) el nombre de la carpeta coincide con `Game.slug`; (c) cada `Icon` referenciado tiene `svg` o `assetId`.
   - Para `demo-reino`, verificar programáticamente las filas de la tabla de cobertura del plan (existe un shield cuyos `blocksThreatTags` usa algún threshold, hay una opción `balance` con `availability` y `whenUnavailable: "show_locked"`, hay cartas de 1, 2 y 3 opciones, etc.).
3. **`simulation.test.ts`** (motor real + `createSeededRng` + `createSequentialId`): para cada bundle y **200 semillas** × 3 políticas (primera opción disponible, última, aleatoria con el mismo rng) jugar `createSession` → `beginTurn` → `resolveChoice` hasta `status !== "active"` con tope de 500 turnos. Aserciones por universo: ninguna ejecución lanza; todas terminan dentro del tope; `endingKey` pertenece a `metadata.endings` cuando existe; la misma semilla repetida produce la misma secuencia de `cardId`s. Solo para `demo-reino`: el conjunto de resultados contiene **al menos una derrota y una victoria** (se permite una cuarta política "voraz" que elige la opción con mayor suma de deltas positivos sobre los parámetros activos; si aun así no hay victoria, ajustar el contenido del fixture, no el test). Para universos reales, victorias/derrotas se registran en un `console.info` informativo (no es objetivo de balance). Anotar en un comentario las proporciones observadas del fixture.
4. **Scripts raíz** (`package.json`):
   - `"universes:validate": "vitest run --project web src/lab/universes/testing"`
   - `"build": "pnpm universes:validate && pnpm build:packages && pnpm --filter @ferpa/web build"` — conservar exactamente el resto del script actual.
   - No tocar `typecheck`, `test` ni los scripts `trymate:*`.

## Fuera de Alcance

- Validar contraste, tipografías o íconos de la estética (es del plan `universes-ui`, task 01 y 07).
- Los skills de `.devin/` (`lint-content.mjs`, `check-tensions.mjs`) siguen siendo la QA de producción de contenido; este test es la **red de seguridad del build** y no los reemplaza.
- Balance del juego.

## Verificación

- [ ] `pnpm universes:validate` pasa. Romper a propósito una referencia en el fixture (p. ej. `characterId` inexistente en una carta) lo hace fallar con `E_REF_MISSING` y el `path` correcto; revertir.
- [ ] Marcar temporalmente un universo `draft` con un error ⇒ el test **no** falla pero imprime el aviso.
- [ ] `pnpm build` ejecuta `universes:validate` antes de compilar y termina OK.
- [ ] `pnpm test` (incluye simulación; tiempo razonable, < 60 s) y `pnpm typecheck`.

## Handoff

Produce: red de seguridad de contenido en el build y simulaciones reutilizables. Cualquier universo nuevo en `content/` queda cubierto sin tocar tests.
