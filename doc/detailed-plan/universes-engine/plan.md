# Plan: Universes — motor, datos, estado y rutas (`/lab/universes`)

## Objetivo

Implementar el **motor de juego, la carga de contenido, el estado de partida y las rutas** de la plataforma de juegos de rol narrativos por decisiones ("Narratives") dentro de este monorepo, como un **módulo autónomo y extraíble** en `apps/web/src/lab/universes/` (mismo patrón que `lab/trymate`).

La plataforma sirve **varios universos** (cada uno es un juego: `Game` + sus parámetros, etapas, ramas, personajes, poderes, insignias, cartas y estética). Los universos se **producen** con el sistema de skills de `.devin/` (ver `doc/universes/README.md`) y llegan a la app como JSON en `apps/web/src/lab/universes/content/<slug>/`. Este plan **no incluye ningún universo real**: usa un universo de pruebas (`demo-reino`) para ejercitar todo el motor.

Este plan entrega: modelo de datos, motor puro y testeado, validación de contenido enganchada al build, carga multi-universo, persistencia local de la partida, hooks de dominio con el contrato para la UI y las rutas (esqueleto jugable en texto plano + prerender de shells). La **UI jugable y la estética por universo** es el plan hermano `../universes-ui/plan.md`, que consume el contrato de [Contrato para la UI](#contrato-para-la-ui).

## Fuente de Requerimientos

- `doc/universes/README.md` — guía autosuficiente del sistema de producción de universos (dónde vive el contenido, formato, estados `draft/in_review/published`).
- `doc/specs/lab/universes/narratives-init.md` — spec funcional (motor §5, calibración §6, permisos §7, criterios §11). **Fuente de verdad funcional.**
- `doc/specs/lab/universes/narrative-game-models.ts` — fuente de verdad de los tipos (§1 a §9).
- `doc/specs/lab/universes/narratives-aesthetics.md` — estética por juego. Este plan solo toma el tipo; el pipeline perfil→CSS es del plan `universes-ui`.
- Reglas del repo: `.devin/rules/rules.md`, `.devin/rules/project-map.md`; skills `add-feature`, `add-query`, `add-route`, `add-store` (en `.devin/skills/`).
- Precedente de módulo autónomo: `apps/web/src/lab/trymate/` (capas `domain/application/infrastructure/components/lib`, guard de ESLint en `eslint.config.js`, shell en `SHELL_ROUTES` de `apps/web/scripts/prerender.mjs`).
- Origen del diseño: este plan es la adaptación a este repo de los planes `emperabord-fase-1` y `emperabord-ux-v1` del repo gran-torneo-tapas-web (que no hace falta consultar: todo lo necesario está acá).

## Decisiones de Arquitectura

Ya resueltas — el executor no debe re-decidirlas:

| # | Decisión | Por qué |
| --- | --- | --- |
| 1 | **Todo el módulo vive en `apps/web/src/lab/universes/`**. No se crea paquete en `packages/` y **no** se usa `@ferpa/data-model`. | Mismo patrón que `lab/trymate`: el módulo es autónomo y se puede extraer a otro repo copiando la carpeta. Los nombres genéricos del modelo (`Badge`, `Icon`, `Game`, `User`…) colisionarían con `@ferpa/ui` y `@ferpa/data-model`. |
| 2 | Tipos del modelo: copia **verbatim** de `doc/specs/lab/universes/narrative-game-models.ts` en `domain/models.ts` (solo se agrega un comentario inicial de 3 líneas). | Una sola definición de tipos dentro del módulo; el spec sigue siendo la fuente. |
| 3 | Capas internas: `domain/` (tipos, motor puro, validación, puertos) → `application/` (hooks, view models, store, queries) → `infrastructure/` (bundle de contenido, `localStorage`) → `components/` + `routes/` (UI). `domain` no importa nada de las otras capas ni de React. | Es el layout de trymate. El `data flow` global de `rules.md` (services→queries→domain→components→routes) se cumple dentro del módulo con estos nombres. |
| 4 | **Multi-universo.** Los universos se descubren con `import.meta.glob` sobre `content/*/game.json` (registro en `infrastructure/registry.ts`). Cada universo se carga perezosamente (`import()` por archivo; un chunk por universo). | Escala a N universos sin tocar código; no engorda el bundle del sitio. |
| 5 | **Solo los universos `published` se muestran en producción** (`Game.status === "published"`). En desarrollo (`import.meta.env.DEV`) también se listan los `draft`/`in_review` y el universo de pruebas. `validateGameContent` rompe el build solo para `published`; para el resto se reporta como aviso. | Se puede trabajar un universo en el repo sin riesgo de publicarlo. |
| 6 | Rutas: `/lab/universes` (lista), `/lab/universes/:slug` (inicio), `/lab/universes/:slug/jugar`, `/lab/universes/:slug/final`. Layout propio (`UniversesLayout`), **no** `AppLayout`. Carga perezosa (`React.lazy`) desde `App.tsx`. | Regla 5 de `rules.md` (deep-linkable) + el bundle principal no crece. |
| 7 | **Prerender de shells.** El hosting usa `not_found_handling = "404-page"` (no hay fallback SPA): un deep link sin `index.html` en `dist/` da 404. Por eso `prerender.mjs` emite un shell por cada ruta de cada universo publicado (helper nuevo `apps/web/scripts/universeShells.mjs`, que lee `game.json`). | Sin esto, recargar `/lab/universes/<slug>/jugar` en producción devolvería 404. |
| 8 | Persistencia de la partida: `localStorage` detrás de un puerto (`SessionRepository`), claves `universes:session:{userId}:{gameId}` y `universes:local-user-id`. Estado de la partida en curso: **Zustand** (`application/store/sessionStore.ts`). | Regla 4: es estado de cliente que no es servidor, derivado ni URL, y debe sobrevivir a re-renders y a la navegación entre `/:slug`, `/jugar` y `/final`. Excepción documentada a "Zustand último recurso". |
| 9 | Tests con **vitest** (ya instalado: proyecto `web`, jsdom, `globals`). Ninguna dependencia nueva. | Reglas 9 de `rules.md`. |
| 10 | **Sin Firebase ni comunidad en este plan.** `FeedbackRepository` y `CardRepository.getCardCounters` existen como puertos con implementación local/no-op; `feedbackEnabled` es siempre `false`. Cartas de usuarios, feedback real, estadísticas y editor son un plan posterior (`universes-community`, no escrito). | Fase mínima jugable y sin riesgo para producción; el módulo `trymate` ya usa Firebase y se puede reutilizar entonces (`getApps()[0] ?? initializeApp`). |
| 11 | Estética: el motor y el hook solo **exponen** `AestheticProfile` y los `ThemeOverride` activos; convertirlos en CSS es del plan `universes-ui`. | Separación de capas (`narratives-aesthetics.md` §2.6). |
| 12 | Prefijo de ids: oficiales `off_`, de usuarios `usr_` (este plan solo valida `off_` en el bundle). Los ids se usan como claves, por eso `/^[A-Za-z0-9_-]+$/`. | Compatibilidad con los skills de producción y con una futura base de datos. |

### Qué NO se toca

`apps/web/src/lab/trymate/`, `packages/*`, `routes/*` existentes del sitio, `AppLayout`, `ThemeProvider`, tokens (`packages/ui/src/theme/tokens.ts`), los datos de `public/data/`, y el contenido de `doc/universes/`. Los únicos archivos existentes que se editan están listados en cada task (`App.tsx`, `eslint.config.js`, `apps/web/scripts/prerender.mjs`, y `package.json` raíz).

## Entidades

Todas las entidades del modelo están en `apps/web/src/lab/universes/domain/models.ts` (copia del spec). **No se redefinen.** Uso en este plan:

| Entidad (§ del modelo) | Dónde vive | Notas |
| --- | --- | --- |
| `Game`, `GameConfig`, `Stage`, `Branch`, `Parameter`, `Character`, `Power`, `Badge`, `Icon`, `MediaAsset`, `AestheticProfile` | `content/<slug>/{game,stages,branches,parameters,characters,powers,badges,icons,assets,aesthetic}.json` | Ids con prefijo `off_`. |
| `SituationCard` | `content/<slug>/cards/NNN-slug.json` (un archivo por carta) | `status: "published"` para entrar al mazo. |
| `GameSession` | `SessionRepository` (`localStorage`) + store Zustand | Una sesión por `(userId, gameId)`. |
| `CardImpression` | Se **construye** en el motor y se entrega a `FeedbackRepository.recordImpression` (no-op local) | Persistencia real: plan posterior. |
| `CardFeedback`, `CardStats`, `User`, `GameCollaborator`, `ContributionRequest`, `GamePermission` | **No se implementan** | Los tipos quedan en el modelo. `CardStats` se usa solo como entrada opcional del motor (`stats = {}` por ahora). |

### Tipos nuevos (no están en el modelo del spec)

Archivo `domain/engine/types.ts` (detalle en [Contrato del motor](#contrato-del-motor)): `GameContent`, `EngineContext`, `GameEvent`, `OptionState`, `BeginTurnResult`, `ResolveInput`, `ResolveResult`, `RelaxationLevel`, `CardStatsMap`, `ValidationIssue`, `RawGameBundle`, `RawCardCounters`.

Archivo `domain/extensions.ts` (extensión tipada de `metadata`, spec §8):

```ts
import type { Game, LocalizedText } from "./models";

/** Finales del juego, referenciados por `end_game.endingKey`. Viven en `Game.metadata.endings`. */
export interface EndingText { title: LocalizedText; text: LocalizedText }
export interface GameEndingsMeta { endings: Record<string, EndingText> }

/** Texto del final; undefined si el juego no lo define (la UI usa un genérico por outcome). */
export function endingFor(game: Game, endingKey: string | undefined): EndingText | undefined {
  const endings = (game.metadata as Partial<GameEndingsMeta> | undefined)?.endings;
  return endingKey && endings ? endings[endingKey] : undefined;
}
```

Constantes en `domain/constants.ts`: `NARRATIVES_SCHEMA_VERSION = 1`, `OFFICIAL_ID_PREFIX = "off_"`, `USER_ID_PREFIX = "usr_"`.


## Contrato del motor

**Única fuente de verdad de las firmas del motor.** Todas las funciones son **puras** (no mutan sus argumentos, devuelven una `GameSession` nueva) y reciben el azar y el reloj inyectados.

```ts
// apps/web/src/lab/universes/domain/engine/types.ts
import type { /* …tipos de ../models… */ } from "../models";

export interface GameContent {
  game: Game;
  stages: Stage[];          // ordenadas por `order` asc
  branches: Branch[];
  parameters: Parameter[];
  characters: Character[];
  powers: Power[];
  badges: Badge[];
  icons: Icon[];
  assets: MediaAsset[];
  cards: SituationCard[];   // solo `status: "published"`, ya validadas
  aesthetic?: AestheticProfile;
}

export interface EngineContext {
  rng: () => number;        // [0, 1)
  now: () => ISODate;
  newId: () => ID;
}

export type CardStatsMap = Readonly<Record<ID, CardStats>>;

/** 0 estricto … 4 último recurso. Ver "Reglas del motor", punto 9. */
export type RelaxationLevel = 0 | 1 | 2 | 3 | 4;

export type GameEvent =
  | { type: "parameter_changed"; parameterId: ID; from: number; to: number; delta: number }
  | { type: "parameter_activated"; parameterId: ID }
  | { type: "parameter_deactivated"; parameterId: ID }
  | { type: "score_changed"; from: number; to: number }
  | { type: "branch_entered"; branchId: ID }
  | { type: "branch_left"; branchId: ID }
  | { type: "character_unlocked"; characterId: ID }
  | { type: "character_locked"; characterId: ID }
  | { type: "power_granted"; powerId: ID; charges: number }
  | { type: "power_consumed"; powerId: ID; charges: number }
  | { type: "badge_awarded"; badgeId: ID }
  | { type: "stage_advanced"; stageId: ID }
  | { type: "threshold_fired"; parameterId: ID; thresholdId: ID }
  | { type: "shield_used"; powerId: ID; parameterId?: ID }
  | { type: "card_enqueued"; cardId: ID; dueTurn: number }
  | { type: "cascade_limit_reached" }
  | { type: "game_ended"; outcome: "victory" | "defeat"; endingKey?: string };

export interface OptionState { option: DecisionOption; state: "available" | "locked" }

export interface BeginTurnResult {
  session: GameSession;                 // con `currentCardId` seteado; o terminada ('no_cards')
  card: SituationCard | null;
  relaxation: RelaxationLevel | "forced"; // "forced" = vino de `cardQueue`
}

export interface ResolveInput { optionId: ID; shownAt: ISODate; responseTimeMs?: number }

export interface ResolveResult {
  session: GameSession;                 // `currentCardId` limpio, `turn` +1, historial actualizado
  events: GameEvent[];                  // en orden de ocurrencia, para la UI
  impression: CardImpression;           // listo para registrar
  chosenOption: DecisionOption;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;                         // ver task 05
  path: string;                         // ej. "cards[off_card_02].options[1].effects[0]"
  message: string;
}
```

```ts
// apps/web/src/lab/universes/domain/engine/index.ts  (barrel; exporta también conditions/effects/weights/validation/localize)
export function createSession(
  content: GameContent,
  init: { userId: ID; locale: LocaleCode },
  ec: EngineContext,
): GameSession;                         // aplica Stage.onEnter de la 1ª etapa; sin carta actual

export function abandonSession(session: GameSession, ec: EngineContext): GameSession; // status 'abandoned', endedAt

export function beginTurn(
  content: GameContent,
  session: GameSession,
  stats: CardStatsMap,
  ec: EngineContext,
): BeginTurnResult;

export function listOptions(
  card: SituationCard,
  session: GameSession,
  content: GameContent,
): OptionState[];                       // ordenadas por `order`; las 'hide' no-disponibles NO aparecen

export function resolveChoice(
  content: GameContent,
  session: GameSession,
  input: ResolveInput,
  ec: EngineContext,
): ResolveResult;

export function evaluateCondition(
  condition: Condition | undefined,
  session: GameSession,
  content: Pick<GameContent, "stages">, // `stage_at_least` necesita mapear stageId -> order
): boolean;                             // undefined => true

export function getThresholdRisk(
  parameter: Parameter,
  value: number,
  ratio?: number,                       // default ENGINE_CONFIG.THRESHOLD_RISK_RATIO
): "low" | "high" | null;               // cerca de un threshold lte (low) o gte (high)

export function localize(text: LocalizedText | undefined, locale: LocaleCode): string;
export function resolveLocale(game: Game, preferred: readonly string[]): LocaleCode;
export function createSeededRng(seed: number): () => number;        // mulberry32

export function validateGameContent(content: GameContent): ValidationIssue[];
export function validateSituationCard(card: SituationCard, content: GameContent): ValidationIssue[];

/** Contenido crudo tal como sale de los JSON (ya tipado en el borde, ver tasks 06 y 07). */
export interface RawGameBundle {
  game: Game; stages: Stage[]; branches: Branch[]; parameters: Parameter[]; characters: Character[];
  powers: Power[]; badges: Badge[]; icons: Icon[]; assets: MediaAsset[]; cards: SituationCard[];
  aesthetic?: AestheticProfile;
}
/** Ordena etapas por `order`, deja solo cartas `published`, arma el `GameContent`. No valida. */
export function assembleGameContent(raw: RawGameBundle): GameContent;
/** Agrega cartas extra (de usuarios): descarta duplicadas por id (gana la existente) e inválidas
 *  (`validateSituationCard` con algún `error`). Devuelve el contenido nuevo y lo descartado. */
export function mergeCards(
  content: GameContent,
  extra: readonly SituationCard[],
): { content: GameContent; dropped: { cardId: ID; reason: "duplicate" | "invalid"; issues: ValidationIssue[] }[] };

export function computeEffectiveWeight(card: SituationCard, stats: CardStats | undefined): number;
export function toCardStats(card: SituationCard, raw: RawCardCounters, now: ISODate): CardStats;
export interface RawCardCounters {
  impressions: number;
  optionChoiceCounts: Record<ID, number>;
  positiveVotes: number;
  negativeVotes: number;
  gameOverCount: number;
  responseTimeTotalMs: number;
}
```

Puertos de repositorio (solo tipos) — `apps/web/src/lab/universes/domain/repositories.ts`:

```ts
export interface GameContentRepository {
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getStages(gameId: ID): Promise<Stage[]>;
  getBranches(gameId: ID): Promise<Branch[]>;
  getParameters(gameId: ID): Promise<Parameter[]>;
  getCharacters(gameId: ID): Promise<Character[]>;
  getPowers(gameId: ID): Promise<Power[]>;
  getBadges(gameId: ID): Promise<Badge[]>;
  getIcons(gameId: ID): Promise<Icon[]>;
  getAssets(gameId: ID): Promise<MediaAsset[]>;
  getAesthetic(aestheticId: ID): Promise<AestheticProfile | undefined>;
}
export interface CardRepository {
  getPublishedCards(gameId: ID): Promise<SituationCard[]>;
  /** Contadores crudos por carta; el `CardStats` completo se deriva con `toCardStats` (necesita la carta). */
  getCardCounters(gameId: ID): Promise<(RawCardCounters & { cardId: ID })[]>;
}
export interface FeedbackRepository {
  submitFeedback(fb: CardFeedback): Promise<void>;
  recordImpression(imp: CardImpression): Promise<void>;
}
export interface SessionRepository {
  load(userId: ID, gameId: ID): Promise<GameSession | null>;
  save(session: GameSession): Promise<void>;
  clear(userId: ID, gameId: ID): Promise<void>;
}
```

## Reglas del motor

El spec deja huecos. Estas decisiones están **resueltas** y son vinculantes para los tasks 02–05 (los tests las verifican). Constantes en `engine/config.ts` (`ENGINE_CONFIG`), nunca inline.

1. **Orden del turno** (`resolveChoice`): (a) validar que `optionId` existe y está `available` (si no: lanzar `Error`); (b) aplicar `option.effects` en orden; (c) evaluar thresholds; (d) desbloqueo automático de personajes (`Character.unlockCondition` sobre los bloqueados); (e) avance de etapa (máx. una por turno); (f) `cardHistory[cardId] = { count+1, lastTurn: turnActual, lastOptionId }`; (g) `turn += 1`, `currentCardId = undefined`, `updatedAt`; (h) construir `CardImpression`.
2. **`end_game` corta**: al ejecutarse, `status` pasa a `won`/`lost`, se setean `endingKey` y `endedAt`, se emite `game_ended` y **no se procesan más efectos** de ese turno (gana el primero). La carta igual queda en `cardHistory`.
3. **Thresholds por nivel, no por flanco**: tras los efectos, para cada parámetro **activo**, cada `ParameterThreshold` cuya comparación se cumple (`lte`/`gte`) se dispara, salvo que `once` y su `id` ya esté en `firedThresholdIds`. Sin `once` se vuelve a disparar en cada turno mientras se cumpla (el validador avisa con `warning` si un threshold sin `once` no contiene `end_game`). **Dentro de un mismo turno cada threshold se dispara a lo sumo una vez** (evita bucles con thresholds sin `once`). Parámetros inactivos no disparan.
4. **`threatTags` efectivos** de un threshold = `threshold.threatTags ∪ chosenOption.threatTags`. Un `end_game` suelto dentro de `option.effects` usa `effect.threatTags ∪ chosenOption.threatTags`.
5. **Shield**: si algún `Power` `shield` del jugador (con `charges ≥ 1`) tiene `blocksThreatTags` que intersecta los tags efectivos → consume **1 carga** (`consume_power`), emite `shield_used`, **no ejecuta** los efectos del threshold (o del `end_game` suelto) y, para thresholds, mueve el parámetro a un **valor seguro**: `lte` → `min(max, threshold.value + round(SHIELD_RECOVERY_RATIO × (max − min)))`; `gte` → `max(min, threshold.value − round(SHIELD_RECOVERY_RATIO × (max − min)))`. Sin ese reposicionamiento un threshold por nivel se re-dispararía en el turno siguiente. El threshold absorbido **no** entra en `firedThresholdIds`. Si hay varios shields aplicables, se usa el de menor `charges` primero (desempate: orden en `session.powers`).
6. **Cascada**: los efectos de un threshold (p. ej. `modify_parameter`, `enter_branch`) pueden disparar otros thresholds. Se procesa con una cola de trabajo y tope `MAX_CASCADE_DEPTH = 10`; al superarlo se emite `cascade_limit_reached` y se deja de evaluar thresholds ese turno (el juego sigue).
7. **Powers `modifier`**: sobre cada `modify_parameter`, `delta' = round(delta × Π multiplier)` de los `modifier` que aplican (`parameterId` indefinido o igual; `appliesTo` según signo de `delta`; `both` siempre). No consumen cargas. Resultado siempre entero; clamp a `[min, max]` del parámetro.
8. **Parámetros inactivos**: un `modify_parameter`/`set_parameter` sobre un parámetro inactivo **sí** actualiza el valor (queda listo para cuando se active) pero no emite thresholds. El validador emite `warning`.
9. **Selección de carta** (`beginTurn`):
   - Primero `cardQueue`: la de menor `dueTurn ≤ turnActual` (desempate: orden de inserción). Se quita de la cola. Si ya no existe en `content.cards` o no tiene opciones disponibles, se descarta y se sigue con la siguiente. `relaxation: "forced"`.
   - Si no, pool = cartas elegibles. **Elegible** (nivel 0) = `availability.branchIds` vacío/ausente **o** intersecta `session.branchIds` ∧ `minStageOrder ≤ etapaActual.order ≤ maxStageOrder` (si definidos) ∧ `difficulty ∈ etapa.difficultyRange` ∧ `evaluateCondition(availability.conditions)` ∧ (si tiene `characterId` y `requireCharacterUnlocked !== false`) personaje desbloqueado ∧ recurrencia (`once` ⇒ `cardHistory[id]` ausente; `repeatable` ⇒ respeta `cooldownTurns` = `turnActual − lastTurn > cooldown` y `maxPerSession`) ∧ no es "reciente" ∧ `listOptions(...)` contiene ≥ 1 `available`.
   - **Reciente** = `cardHistory[id]` existe y `turnActual − lastTurn ≤ GameConfig.recentCardsWindow`. (No hace falta campo nuevo en `GameSession`.)
   - Relajación si el pool queda vacío, **en este orden**: nivel 1 ignora "reciente"; nivel 2 además ignora `cooldownTurns`; nivel 3 además amplía `difficultyRange` ±1; nivel 4 además ignora `minStageOrder/maxStageOrder` y la dificultad (sigue exigiendo publicada, rama, condiciones, personaje, `once`/`maxPerSession` y opciones). **`once` y `maxPerSession` nunca se relajan.**
   - Si tras el nivel 4 no hay carta: `status = "lost"`, `endingKey = "no_cards"`, `endedAt`, evento `game_ended` y `card: null`.
   - Sorteo ponderado por `computeEffectiveWeight(card, stats[card.id])` con `ec.rng()`. Pesos ≤ 0 se tratan como 0; si todos son 0, uniforme.
10. **Opciones** (`listOptions`): una opción es `available` si `availability` (si existe) evalúa `true` **y**, si tiene `unlockTag`, el jugador posee un `Power` `option_unlock` con ese `unlocksOptionTag` y `charges ≥ 1`. No disponible + `whenUnavailable: "hide"` ⇒ no aparece; `"show_locked"` ⇒ aparece con `state: "locked"`. Los `option_unlock` **no** consumen carga salvo que la opción incluya un `consume_power`.
11. **Etapas**: tras el turno, si la siguiente etapa por `order` cumple `score ≥ minScore` ∧ `evaluateCondition(enterConditions)`, se avanza: `stageId`, `activatesParameterIds` (como `activate_parameter`), luego `onEnter`, y se re-evalúan thresholds (misma cola/cascada). Evento `stage_advanced`. `createSession` hace lo mismo para la etapa inicial.
12. **Puntaje**: solo cambia con `add_score`. No hay puntaje automático por turno (ver [Preguntas abiertas](#preguntas-abiertas--supuestos)).
13. **Pureza**: ninguna función usa `Math.random`, `Date.now` ni `crypto` directos; todo por `EngineContext`. `createSeededRng(seed)` (mulberry32) existe para tests y QA.
14. **Peso efectivo** (`computeEffectiveWeight`, valores iniciales ajustables en `ENGINE_CONFIG`): si `stats` es `undefined` o `impressions < MIN_IMPRESSIONS_FOR_WEIGHT (20)` ⇒ `baseWeight`. Si no: `baseWeight × feedbackFactor × difficultyFitFactor`, con `feedbackFactor = clamp(2·(pos+1)/(pos+neg+2), 0.2, 2.0)` y `difficultyFitFactor = 1 − min(0.5, |observedDifficulty − difficulty| / 10)`. `toCardStats` deriva `lossRateAfter = gameOverCount / impressions` (aproximación de esta fase: solo cuenta la carta que terminó la partida), `observedDifficulty = clamp(round(1 + 9·min(1, 3·lossRateAfter)), 1, 10)`, `avgResponseTimeMs = responseTimeTotalMs / impressions` y `needsReview = (pos+neg ≥ 10 ∧ neg/(pos+neg) > 0.6)`.

## Fuente de Datos

| Recurso | Tipo | Path | Shape |
| --- | --- | --- | --- |
| Juego, etapas, ramas, parámetros, personajes, poderes, insignias, íconos, assets, estética | JSON embebido en el build | `apps/web/src/lab/universes/content/<slug>/{game,stages,branches,parameters,characters,powers,badges,icons,assets,aesthetic}.json` | Arreglos / objetos de las entidades de `models.ts` (`game.json` y `aesthetic.json` son objetos) |
| Cartas | JSON embebido, 1 archivo por carta | `content/<slug>/cards/NNN-slug.json` | `SituationCard` |
| Universo de pruebas | Igual que arriba | `apps/web/src/lab/universes/testing/fixtures/demo-reino/` | Solo se descubre en `import.meta.env.DEV` y en tests |
| Partida | `localStorage` | `universes:session:{userId}:{gameId}` | `{ v: 1, session: GameSession }` |
| Identidad local | `localStorage` | `universes:local-user-id` | `string` (uuid) |

Los JSON los producen los skills de `.devin/` (ver `doc/universes/README.md`); **este plan no cambia el formato**. `Game.metadata.endings` (finales) sigue la extensión `GameEndingsMeta`.

## Lógica Derivada

- Todo cálculo de reglas: `domain/engine/*` (puro, sin React ni browser APIs).
- Vistas para la UI (nombres localizados, riesgo de threshold, deltas, textos de eventos, `ThemeOverride` activos): `application/viewModels.ts` y `application/useNarrativeGame.ts` (mappers y orquestación; **sin** reglas de juego).
- Fases de pantalla (`card` / `outcome` / `ended`…): derivadas de `GameSession` + `lastResolution` del store (`derivePhase`); no se duplican en otro estado.

## Estructura de archivos

```
apps/web/src/lab/universes/
  index.ts                         # barrel público: solo exporta las páginas/rutas (lo único que importa App.tsx)
  README.md                        # cómo extraer el módulo a otro repo (task 01)
  domain/
    models.ts  constants.ts  extensions.ts  repositories.ts
    engine/  config.ts types.ts localize.ts rng.ts conditions.ts effects.ts thresholds.ts risk.ts
             session.ts options.ts selection.ts stages.ts turn.ts weights.ts validation.ts content.ts
             testing.ts index.ts (+ *.test.ts)
  application/
    types.ts viewModels.ts derivePhase.ts transitions.ts engineContext.ts
    useUniverses.ts useNarrativeContent.ts useUniverseTheme.ts useNarrativeGame.ts useCurrentUser.ts
    keys.ts store/sessionStore.ts   (+ *.test.ts)
  infrastructure/
    registry.ts bundledContent.ts storage.ts identity.ts localSessions.ts offlineRepositories.ts
    repositories.ts errors.ts index.ts (+ *.test.ts)
  content/<slug>/…                 # universos reales (vacío al empezar: solo .gitkeep)
  testing/fixtures/demo-reino/…    # universo de pruebas
  routes/ UniversesIndexPage.tsx UniversePage.tsx UniversePlayPage.tsx UniverseEndPage.tsx universesRouting.ts
  components/                      # UI (plan universes-ui)
  lib/                             # utilidades chicas (copy, seo)
apps/web/scripts/universeShells.mjs   # genera shells de prerender
```

## Pantallas / Rutas / Componentes

| Pieza | Nivel | Ubicación |
| --- | --- | --- |
| `UniversesLayout` | Layout | `lab/universes/components/UniversesLayout.tsx` (stub aquí; lo rediseña `universes-ui`) |
| `UniversesIndexPage` | Route `/lab/universes` | `lab/universes/routes/` (stub aquí) |
| `UniversePage` | Route `/lab/universes/:slug` | idem |
| `UniversePlayPage` | Route `/lab/universes/:slug/jugar` | idem |
| `UniverseEndPage` | Route `/lab/universes/:slug/final` | idem |
| `useNarrativeGame`, `useNarrativeContent`, `useUniverses`, `useCurrentUser` | Hooks | `lab/universes/application/` |
| `sessionStore` | Store | `lab/universes/application/store/sessionStore.ts` |
| Registro y repositorios | Infra | `lab/universes/infrastructure/` |

No se agrega nada a `packages/ui` ni a `packages/data-model`.

## Contrato para la UI

El plan `universes-ui` **solo** consume este contrato (lo implementa el task 11). Archivos: `application/types.ts` (tipos), `application/viewModels.ts` y `application/useNarrativeGame.ts`. Cambios respecto del diseño original del que se adapta: el hook recibe el `slug`; se agregan `slug`, `notFound`, `locale`, `theme` e `icons`.

```ts
import type { AestheticProfile, CardFeedback, ID, ThemeOverride } from "../domain/models";

export interface ParameterView {
  id: ID; key: string; name: string;      // name ya localizado
  iconId?: ID;
  value: number; min: number; max: number; ratio: number;   // ratio = (value-min)/(max-min), 0..1
  delta: number | null;                   // cambio del último turno resuelto; null si no hubo
  risk: "low" | "high" | null;            // de getThresholdRisk
}
export interface PowerView { id: ID; name: string; kind: "shield" | "option_unlock" | "modifier" | "custom"; charges: number; maxCharges?: number; iconId?: ID }
export interface OptionView {
  id: ID; order: number; label: string; kind: "standard" | "balance";
  state: "available" | "locked"; lockedReason?: string;   // p. ej. "Requiere: Consejo sabio"
}
export interface SpeakerView { name: string; title?: string; portraitUrl?: string; portraitAlt?: string }
export interface MediaView { type: "image" | "video" | "animation"; url: string; posterUrl?: string; alt: string }
export interface CardView { id: ID; text: string; difficulty: number; media?: MediaView; speaker?: SpeakerView; options: OptionView[] }
export interface EventView { type: string; tone: "gain" | "loss" | "neutral"; text: string; parameterId?: ID; delta?: number }
export interface OutcomeView { chosenLabel: string; outcomeText?: string; events: EventView[]; ended: boolean; result?: "victory" | "defeat" }
export interface StageView { id: ID; order: number; name: string; total: number }
export interface EndView {
  result: "victory" | "defeat" | "abandoned"; title: string; text: string;
  turns: number; score: number; stageName: string;
  badges: { id: ID; name: string; iconId?: ID }[]; parameters: ParameterView[];
}
export interface IconView { svg?: string; label: string; semanticTags: string[] }   // label ya localizado
/** Estética lista para convertir en CSS (la conversión es del plan universes-ui). */
export interface ThemeInput { aesthetic?: AestheticProfile; activeOverrides: ThemeOverride[] }

export type NarrativePhase =
  | "loading" | "error"
  | "no_session"   // no hay partida guardada
  | "between"      // partida activa sin carta mostrada (solo se ve si NO se pidió `autoStartTurn`)
  | "card" | "outcome" | "ended";

export interface NarrativeGame {
  slug: string;
  phase: NarrativePhase;
  notFound: boolean;                        // phase === "error" porque el slug no existe o no está publicado
  title: string; description: string;       // del Game, localizados
  locale: string;                           // locale resuelto de la sesión (para <html lang> en la UI)
  theme: ThemeInput;
  icons: Record<ID, IconView>;              // iconId → ícono del universo (para parámetros, poderes e insignias)
  hasSavedSession: boolean;                 // hay partida activa guardada
  stage?: StageView; turn: number; score: number;
  parameters: ParameterView[];              // solo activos, en orden de `content.parameters`
  powers: PowerView[];
  card?: CardView;                          // phase === "card"
  outcome?: OutcomeView;                    // phase === "outcome"
  end?: EndView;                            // phase === "ended" (también tras abandonar)
  feedbackEnabled: boolean;                 // siempre false en este plan
  feedbackSent: boolean;
  startNewGame(): void;                     // reemplaza la guardada; deja phase "card"
  choose(optionId: ID): void;               // phase "card" → "outcome"
  next(): void;                             // "outcome" → "card" (o "ended" si terminó)
  abandon(): void;                          // marca 'abandoned' → "ended"
  sendFeedback(value: CardFeedback["value"], reason?: CardFeedback["reason"]): void; // no-op mientras feedbackEnabled=false
  retry(): void;                            // invalida las queries del universo (phase "error")
}
export function useNarrativeGame(slug: string, options?: { autoStartTurn?: boolean }): NarrativeGame;
```

Reglas del contrato: (1) `phase` es `"no_session"` si no hay partida activa ni terminada; (2) con `autoStartTurn: true` (lo usa la página de juego) y partida activa sin carta actual, el hook **inicia el turno solo** y la UI ve `"loading"` un instante; sin esa opción (inicio) ve `"between"`; (3) tras un `choose` que termina el juego, `phase === "outcome"` con `outcome.ended = true`; el `next()` siguiente pasa a `"ended"`; (4) `abandon()` y el fin natural dejan la sesión terminada guardada hasta `startNewGame()`; (5) no hay "continuar" explícito: la UI usa `hasSavedSession` para ofrecer "Continuar" y navega a `/lab/universes/:slug/jugar`; (6) un slug inexistente o no publicado (en producción) da `phase: "error"` con `notFound: true`.


## Contenido de prueba (universo `demo-reino`)

El contenido real del juego lo define el dueño. Para poder **jugar y probar el motor entero**, el task 07 crea el universo de pruebas **`demo-reino`** (`metadata.placeholder = true` en `Game`; fixture en `testing/fixtures/`, no en `content/`), temática neutra "gobernar un reino", fácil de reemplazar archivo por archivo. Cobertura **obligatoria** (cada fila debe estar ejercitada por al menos una carta/entidad):

| Característica del motor | Cómo lo cubre el universo de pruebas |
| --- | --- |
| Parámetros que crecen (2 → 4) | Etapa 1 activa `tesoro`+`pueblo`; etapa 2 activa `ejercito`; etapa 3 activa `prestigio` |
| Thresholds 0 / 100 | Todos `lte 0` ⇒ derrota; `pueblo gte 100` ⇒ insignia (`once`); `prestigio gte 100` ⇒ victoria |
| Shield | `pueblo lte 0` lleva `threatTags: ["internal_threat"]`; poder `guardia` (shield) lo absorbe |
| Opción de equilibrio bloqueada por poder | Carta con `balance` + `availability: has_power(consejo_sabio)` + `whenUnavailable: "show_locked"` |
| Cartas de 1, 2 y 3 opciones | Al menos una de cada |
| Ramas exclusivas | `guerra` / `diplomacia` (`exclusiveGroup: "camino"`) y cartas propias de cada una + cartas globales |
| Memoria | Carta con `conditions: card_seen(cardId, optionId)` |
| `once` vs `repeatable` (+ `cooldownTurns`) | Ambas |
| Personaje bloqueado → desbloqueado | `general` se desbloquea por `unlock_character`; sus cartas no salen antes |
| Carta sin personaje / con personaje / con asset | Las tres variantes (el asset puede ser una URL placeholder local en `public/universes/`) |
| Cola forzada | `enqueue_card` con `delayTurns` |
| Powers `modifier` y `option_unlock` | Uno de cada |
| Cambio de etapa y `difficultyRange` | 3 etapas con rangos `[1,4]`, `[3,7]`, `[5,10]` y `minScore` 0 / 8 / 20 |
| Traducciones | `translations.en` en título del juego, 2 parámetros y 2 cartas |
| Finales | `Game.metadata.endings` con ≥ 3 finales (`sin_tesoro`, `sin_pueblo`, `coronacion`) y `no_cards` |

Debe poder terminar tanto en derrota como en victoria; un test de simulación (task 08) juega partidas con semillas fijas y comprueba que ninguna queda atascada.

## Publicación de universos

- Un universo está **publicado** cuando su `game.json` tiene `status: "published"`. Los skills de producción deben generarlo en `draft` (el task 01 ajusta la plantilla); publicar es un cambio manual y deliberado, seguido de `pnpm universes:validate`.
- Producción: `/lab/universes` lista solo los publicados; los demás no tienen shell de prerender (404) y, aunque sus JSON queden empaquetados en chunks perezosos, no están enlazados. Si algún día el contenido en borrador debe ser secreto, hay que sacarlo del repo o filtrarlo en el build (riesgo aceptado, ver Preguntas Abiertas).
- Desarrollo (`pnpm dev`): también se listan los `draft`/`in_review` y el universo de pruebas `demo-reino`.

## Secuencia de Implementación

| # | Task file | Capa / Skill | Depende de |
| --- | --- | --- | --- |
| 1 | `tasks/01-module-skeleton-and-guards.md` | tooling + `add-feature` | — |
| 2 | `tasks/02-localize-rng-conditions.md` | `add-feature` (paso 1) | 1 |
| 3 | `tasks/03-effects-thresholds-shields.md` | `add-feature` (paso 1) | 2 |
| 4 | `tasks/04-session-selection-turn.md` | `add-feature` (paso 1) | 3 |
| 5 | `tasks/05-validation-and-weights.md` | `add-feature` (paso 1) | 1 |
| 6 | `tasks/06-registry-and-bundled-content.md` | `add-query` (capa de infraestructura) | 1, 5 |
| 7 | `tasks/07-demo-fixture-universe.md` | datos | 4, 5 |
| 8 | `tasks/08-content-validation-and-simulation.md` | QA + tooling | 4, 5, 6, 7 |
| 9 | `tasks/09-local-persistence-and-repositories.md` | `add-query` | 1, 6 |
| 10 | `tasks/10-queries-and-store.md` | `add-query` / `add-store` | 6, 9 |
| 11 | `tasks/11-domain-hooks-and-contract.md` | `add-feature` (paso 5) | 4, 10 |
| 12 | `tasks/12-routes-seo-prerender.md` | `add-route` | 6, 11 |
| 13 | `tasks/13-final-verification.md` | verificación | todos |

Paralelismo: **2→3→4** (cadena del motor) y **5** pueden avanzar en paralelo tras el 1; **9** puede empezar en cuanto exista el 6. **7** necesita el motor (4) y la validación (5). El plan `universes-ui` puede empezar apenas termine el **12** (usa el contrato; el esqueleto de rutas ya permite jugar en texto plano).

## Criterios de Aceptación Globales

- [ ] `narrative-game-models.ts` copiado verbatim en `domain/models.ts`; tipos definidos **una sola vez** dentro del módulo; nada de `@ferpa/data-model` ni `@ferpa/ui` importado desde `domain/`.
- [ ] El motor es puro: sin React, sin browser APIs, sin `Math.random`/`Date.now`/`crypto` directos; todos los tests unitarios del motor pasan (`pnpm test`).
- [ ] `pnpm universes:validate` falla ante cualquier violación de integridad (`narratives-init.md §3.1`) de un universo `published` y está enganchado al `build` raíz.
- [ ] Una partida completa funciona **sin red** una vez cargada la app; recargar en `/lab/universes/:slug/jugar` restaura la partida.
- [ ] Rama X no aparece fuera de la rama X; `once` no reaparece; `repeatable` respeta cooldown y máximo; `balance` solo aparece si se cumple su condición.
- [ ] Threshold + shield: con shield consume carga y no dispara; sin shield dispara.
- [ ] Parámetros nuevos se activan al avanzar de etapa y cambia el `difficultyRange`.
- [ ] Texto sin traducción cae a `default`.
- [ ] Multi-universo: agregar una carpeta `content/<otro-slug>/` válida y `published` la hace aparecer en `/lab/universes` sin tocar código.
- [ ] Prerender: `dist/lab/universes/index.html` y, por cada universo publicado, `dist/lab/universes/<slug>/{index.html,jugar/index.html,final/index.html}`; el resto del prerender del sitio no cambia.
- [ ] `/`, `/cv`, `/projects/:id` y `/lab/trymate` siguen funcionando igual; el chunk de `/lab/universes` no entra al bundle inicial.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pasan sin errores.
- [ ] Sin `any`, sin hex/fuentes hardcodeados, named exports, sin `export default`.

## Fuera de Alcance Global

- La UI jugable y la estética por universo (plan `universes-ui`).
- Firebase, auth, cartas de usuarios, feedback y estadísticas reales, editor de cartas, moderación (plan futuro `universes-community`).
- Pipeline de imágenes/íconos generados, `composePrompt`, `assets:outdated`, pantalla Style Guide (`narratives-aesthetics.md` §4, §7.3, §13).
- `GameCollaborator`, `ContributionRequest`, permisos por juego, creación de universos por usuarios desde la UI.
- Contenido real de cualquier universo (se produce con los skills de `.devin/`).
- Cambios al resto del sitio (home, CV, proyectos, `trymate`), a `packages/*` y a los tokens.
- Enlace a `/lab/universes` desde la home o el CV (decisión del dueño, después).

## Preguntas Abiertas / Supuestos

1. **Contenido en borrador en el bundle.** `import.meta.glob` empaqueta todos los universos de `content/` (en chunks perezosos); los `draft` no se enlazan ni se prerenderizan, pero sus JSON quedan en `dist/assets`. Aceptable mientras el contenido no sea confidencial. Alternativa si lo fuera: trabajar el universo en una rama y mergear solo al publicar.
2. **Plantilla de `game.json` de los skills.** Hoy genera `status: "published"` y no incluye `metadata.endings`; el task 01 la corrige (`draft` + finales). Asunción: ningún universo real fue generado todavía con la plantilla vieja.
3. **Puntaje por turno.** El modelo solo suma puntos vía `add_score`. Si se quiere sumar por sobrevivir cada carta habría que agregar `GameConfig.scorePerTurn` (cambio de modelo + spec). Se asume que **no**.
4. **Constantes del motor** inventadas y ajustables en `ENGINE_CONFIG`: `SHIELD_RECOVERY_RATIO = 0.1`, `THRESHOLD_RISK_RATIO = 0.15`, `MIN_IMPRESSIONS_FOR_WEIGHT = 20`, fórmula de `observedDifficulty`, umbral `needsReview`. Revisar tras ver partidas reales.
5. **Thresholds por nivel** (regla 3) en lugar de por flanco, por robustez; cambiarlo solo toca `engine/thresholds.ts`.
6. **Zustand para la partida** (decisión 8): excepción documentada a "Zustand último recurso".
7. **Identidad local.** Sin auth, `userId` es un uuid en `localStorage`; si en el futuro hay auth, las partidas locales no se migran.
8. **`kind` y extensiones por tipo de juego** (`Game.kind`, spec §8): este plan no las usa; el motor es agnóstico del tipo.
9. **Versión de vitest/TS**: se usan las ya instaladas (`vitest ^3`, TS 5.6). No se agregan dependencias.
