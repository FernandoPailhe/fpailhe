# Task 05: Validación de contenido, ensamblado/merge de cartas y pesos

> Parte del plan: `../plan.md` — ver "Reglas del motor" #14 (pesos), `doc/specs/lab/universes/narratives-init.md §3.1` (integridad) y "Contrato del motor" (`validateGameContent`, `validateSituationCard`, `assembleGameContent`, `mergeCards`, `computeEffectiveWeight`, `toCardStats`).

## Skill / Capa

`add-feature` paso 1 (funciones puras en `domain/` del módulo).

## Objetivo

Validar contenido oficial y cartas de usuario, ensamblar el `GameContent`, mergear cartas extra descartando las inválidas, y calcular pesos/estadísticas de calibración.

## Depende De

- Task 01 (tipos). Puede hacerse en paralelo con 02–04; si `weights.ts` ya existe como stub (Task 04), reemplazarlo.

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/domain/engine/validation.ts` — crear
- `apps/web/src/lab/universes/domain/engine/content.ts` — crear (`assembleGameContent`, `mergeCards`)
- `apps/web/src/lab/universes/domain/engine/weights.ts` — crear/reemplazar (`computeEffectiveWeight`, `toCardStats`)
- `engine/validation.test.ts`, `content.test.ts`, `weights.test.ts` — crear
- `engine/index.ts` — editar (exportar)

## Detalles de Implementación

### `validateGameContent(content): ValidationIssue[]`

Una pasada que acumula issues (nunca lanza). `path` con formato `colección[id].campo[i]`. Códigos (los `error` rompen el build):

| Código | Sev. | Regla |
| --- | --- | --- |
| `E_DUP_ID` | error | ids repetidos dentro de una colección; `option.id` repetido dentro de una carta; `threshold.id` repetido en el juego |
| `E_ID_CHARS` | error | todo `id` debe cumplir `/^[A-Za-z0-9_-]+$/` (se usan como claves de Firestore) |
| `E_ID_PREFIX` | error | las entidades del bundle oficial deben empezar con `off_` |
| `E_GAME_MISMATCH` | error | `entity.gameId !== game.id` |
| `E_REF_MISSING` | error | cualquier id referenciado que no existe (config inicial, `activatesParameterIds`, efectos, condiciones, `card.assetId/characterId/branchIds`, `character.portraitAssetId`, `*.iconId`, `modifier.parameterId`, `badgeId`, `cardId` de `enqueue_card`/`card_seen`, `game.aestheticId` vs `content.aesthetic.id` si hay aesthetic) |
| `E_OPTIONS_COUNT` | error | `options.length` fuera de 1..3 |
| `E_OPTION_ORDER` | error | `order` repetido dentro de la carta |
| `E_MULTI_BALANCE` | error | más de una opción `kind: "balance"` |
| `E_DIFFICULTY` | error | `card.difficulty` no entero 1..10; `Stage.difficultyRange` fuera de 1..10 o `min > max` |
| `E_PARAM_RANGE` | error | `min >= max` o `initialValue` fuera de rango |
| `E_TEXT_EMPTY` | error | `LocalizedText.default` vacío en `game.title`, `*.name`, `card.text`, `option.label` |
| `E_STAGE_ORDER` | error | `order` de etapas repetido, o sin etapas |
| `E_INITIAL_ACTIVE` | error | `initialActiveParameterIds` vacío o con ids inexistentes |
| `E_CARD_STATUS` | error | `content.cards` con `status !== "published"` |
| `W_NO_ICON` | warning | parámetro/poder/insignia sin `iconId` |
| `W_THRESHOLD_NO_END` | warning | threshold sin `once` y sin `end_game` (se re-dispara cada turno) |
| `W_PARAM_NEVER_ACTIVE` | warning | parámetro que no está en la config inicial, ni en `activatesParameterIds`, ni en un `activate_parameter` |
| `W_BALANCE_UNGATED` | warning | opción `balance` sin `availability` ni `unlockTag` |
| `W_THRESHOLD_RANGE` | warning | `threshold.value` fuera de `[min,max]` |

### `validateSituationCard(card, content)`

Las reglas **a nivel carta** de arriba (E_DUP_ID de opciones, E_OPTIONS_COUNT, E_OPTION_ORDER, E_MULTI_BALANCE, E_DIFFICULTY, E_TEXT_EMPTY, E_ID_CHARS) más `E_REF_MISSING` contra `content`, `E_GAME_MISMATCH` (`card.gameId === content.game.id`) y, para cartas de usuario, `E_ID_PREFIX` invertido: si `card.origin === "community"` el id debe empezar con `usr_` y debe tener `createdBy` (no validar permisos acá). Reutilizar las funciones internas, no duplicar lógica.

### `assembleGameContent(raw)` y `mergeCards(content, extra)`

- `assembleGameContent`: `stages` ordenadas por `order`; `cards = raw.cards.filter(c => c.status === "published")`; resto copiado. **No** valida.
- `mergeCards`: para cada carta extra: si su `id` ya existe → `dropped { reason: "duplicate" }` (gana la existente); si `validateSituationCard(card, content)` tiene algún `error` → `dropped { reason: "invalid", issues }`; solo se agregan las `published`. Devuelve contenido nuevo (inmutable) + lista `dropped`.

### `weights.ts` (regla 14)

```ts
export function computeEffectiveWeight(card: SituationCard, stats: CardStats | undefined): number;
export function toCardStats(card: SituationCard, raw: RawCardCounters, now: ISODate): CardStats;
```

- `computeEffectiveWeight`: `stats` indefinido o `impressions < MIN_IMPRESSIONS_FOR_WEIGHT` ⇒ `card.baseWeight`; si no `baseWeight × feedbackFactor × difficultyFitFactor` (fórmulas en la regla 14, con `FEEDBACK_FACTOR_MIN/MAX`).
- `toCardStats`: copia contadores; `avgResponseTimeMs = impressions ? responseTimeTotalMs / impressions : 0`; `lossRateAfter = impressions ? gameOverCount / impressions : 0`; `observedDifficulty = clamp(round(1 + 9·min(1, 3·lossRateAfter)), 1, 10)`; `needsReview = (pos+neg ≥ NEEDS_REVIEW_MIN_VOTES) && neg/(pos+neg) > NEEDS_REVIEW_NEGATIVE_RATIO`; `effectiveWeight = computeEffectiveWeight(card, <stats parciales>)` (calcular `observedDifficulty` primero y pasarlo); `updatedAt = now`.

## Fuera de Alcance

- Validar contraste, tipografías o estética (es el plan de estética).
- Leer archivos del disco (el test de contenido real está en Task 08).
- Permisos de usuario/creador.

## Verificación

- [ ] Tests: un contenido válido mínimo no produce `error`; **un test por cada código `E_*`** (construir contenido inválido con `makeContent` y comprobar el `code` y el `path`); los `W_*` no son `error`; `mergeCards` (carta válida se agrega, duplicada y con ref inexistente se descartan con motivo, inmutabilidad); `computeEffectiveWeight` (sin stats → base; `impressions < 20` → base; más votos positivos → mayor peso; dificultad observada lejos de la declarada → menor peso; límites 0.2/2.0); `toCardStats` (promedios, `needsReview` en el borde 10 votos / 60 %).
- [ ] `pnpm vitest run --project web src/lab/universes/domain` y `typecheck`.

## Handoff

Produce: `validateGameContent`, `validateSituationCard`, `assembleGameContent`, `mergeCards`, `computeEffectiveWeight`, `toCardStats`. Task 06 usa `assembleGameContent`; Task 08 los usa para validar los universos; el plan futuro `universes-community` los reutilizará para cartas de usuarios.
