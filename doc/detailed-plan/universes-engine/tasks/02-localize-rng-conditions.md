# Task 02: Localización, RNG determinista y evaluador de condiciones

> Parte del plan: `../plan.md` — ver "Contrato del motor" y "Reglas del motor" #13.

## Skill / Capa

`add-feature` paso 1 (funciones puras en `domain/` del módulo).

## Objetivo

Implementar `localize`, `resolveLocale`, `createSeededRng`, `createSequentialId` y `evaluateCondition` con tests.

## Depende De

- Task 01: tipos `Condition`, `GameSession`, `Game`, `LocalizedText`, `GameContent`.

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/domain/engine/localize.ts` — crear
- `apps/web/src/lab/universes/domain/engine/rng.ts` — crear
- `apps/web/src/lab/universes/domain/engine/conditions.ts` — crear
- `apps/web/src/lab/universes/domain/engine/testing.ts` — crear (helpers de test, exportado solo para tests)
- `apps/web/src/lab/universes/domain/engine/localize.test.ts`, `rng.test.ts`, `conditions.test.ts` — crear
- `apps/web/src/lab/universes/domain/engine/index.ts` — editar (exportar los módulos, **excepto** `testing.ts`)

## Detalles de Implementación

**`localize.ts`**

```ts
export function localize(text: LocalizedText | undefined, locale: LocaleCode): string;
export function resolveLocale(game: Game, preferred: readonly string[]): LocaleCode;
```

- `localize`: `undefined` → `""`. Orden: `translations[locale]` → `translations[base(locale)]` (base = parte antes de `-`) → `default`. Una traducción vacía (`""`) cuenta como ausente.
- `resolveLocale`: para cada `preferred` en orden: coincidencia exacta (case-insensitive) en `game.supportedLocales`; si no, la primera `supportedLocales` con la misma base; si ninguna coincide → `game.defaultLocale`. Seguro sin `navigator` (el caller pasa el arreglo).

**`rng.ts`**

- `createSeededRng(seed: number): () => number` — mulberry32:

```ts
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createSequentialId(prefix = "id"): () => string; // "id_1", "id_2", …
```

**`conditions.ts`** — `evaluateCondition(condition, session, content)`:

- `undefined` → `true`.
- `all` (todas; `[]` → true), `any` (alguna; `[]` → false), `not`.
- `parameter`: valor = `session.parameters[parameterId]`; si es `undefined` → `false`; comparar con `compare(a, comparator, b)` (implementar los 6 `Comparator`).
- `score`, `turn`: comparan `session.score` / `session.turn`.
- `stage_at_least`: orden de la etapa actual = `content.stages.find(s => s.id === session.stageId)?.order`; si no existe → `false`; `>= stageOrder`.
- `in_branch`: `session.branchIds.includes(branchId)`.
- `has_flag`: sin `value` → la clave existe en `session.flags`; con `value` → igualdad estricta.
- `has_power`: existe en `session.powers` con `charges >= (minCharges ?? 1)`.
- `character_unlocked`: `session.unlockedCharacterIds.includes(characterId)`.
- `card_seen`: sin `optionId` → `session.cardHistory[cardId]?.count > 0`; con `optionId` → `cardHistory[cardId]?.lastOptionId === optionId`.
- El `switch` debe ser exhaustivo (usar `never` en el `default`) para que agregar un tipo de condición rompa el typecheck.

**`testing.ts`**: `makeSession(overrides?: Partial<GameSession>): GameSession` (sesión mínima válida: `status: "active"`, `turn: 0`, `score: 0`, `stageId: "off_stage_1"`, mapas vacíos, `id: "s1"`, etc.) y `makeContent(overrides?: Partial<GameContent>): GameContent` con 2 etapas (`off_stage_1` order 1, `off_stage_2` order 2) y listas vacías. Lo usarán los tests de Tasks 02–05.

## Fuera de Alcance

- No evaluar thresholds ni aplicar efectos (Task 03).
- No acceder a `navigator`, `window`, `Math.random` ni `Date`.

## Verificación

- [ ] `pnpm vitest run --project web src/lab/universes/domain` con casos para: cadena de fallback de `localize` (exacto → base → default; vacío → default; `undefined`), `resolveLocale` (exacto, por base, fallback al default), determinismo y rango `[0,1)` de `createSeededRng`, cada hoja de `evaluateCondition` (verdadera y falsa), `all/any/not` y `undefined`.
- [ ] `pnpm typecheck`

## Handoff

Produce: `localize`, `resolveLocale`, `createSeededRng`, `createSequentialId`, `evaluateCondition` y los helpers `makeSession`/`makeContent` para los tasks siguientes.
