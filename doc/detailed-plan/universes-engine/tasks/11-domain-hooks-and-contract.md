# Task 11: Hooks de dominio y contrato para la UI

> Parte del plan: `../plan.md` — **"Contrato para la UI" es la especificación exacta de este task** (tipos y reglas 1–6). Ver también "Lógica Derivada" y "Reglas del motor".

## Skill / Capa

`add-feature` paso 5 (`application/`). Mappers y orquestación sin JSX y **sin reglas de juego** (esas viven en el motor).

## Objetivo

Implementar `useNarrativeContent`, `useCurrentUser` y `useNarrativeGame(slug, options?)` más los view models y las transiciones puras, de modo que cualquier UI pueda jugar una partida completa consumiendo solo el contrato del plan.

## Depende De

- Task 04 (motor completo), Task 10 (queries y store). Usa `getThresholdRisk` (Task 03), `localize`/`resolveLocale`/`evaluateCondition` (Task 02).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/application/types.ts` — crear (copia de los tipos del bloque de `../plan.md#contrato-para-la-ui`)
- `apps/web/src/lab/universes/application/viewModels.ts` + `viewModels.test.ts` — crear (funciones puras)
- `apps/web/src/lab/universes/application/derivePhase.ts` + `derivePhase.test.ts` — crear
- `apps/web/src/lab/universes/application/transitions.ts` + `transitions.test.ts` — crear
- `apps/web/src/lab/universes/application/engineContext.ts` — crear
- `apps/web/src/lab/universes/application/useNarrativeContent.ts` — crear
- `apps/web/src/lab/universes/application/useCurrentUser.ts` — crear
- `apps/web/src/lab/universes/application/useUniverseTheme.ts` — crear
- `apps/web/src/lab/universes/application/useNarrativeGame.ts` — crear
- `apps/web/src/lab/universes/application/index.ts` — crear (barrel; es lo único que importan las rutas y los componentes, junto con los tipos del dominio)

## Detalles de Implementación

1. **`types.ts`**: los tipos `ParameterView`, `PowerView`, `OptionView`, `SpeakerView`, `MediaView`, `CardView`, `EventView`, `OutcomeView`, `StageView`, `EndView`, `ThemeInput`, `IconView`, `NarrativePhase`, `NarrativeGame` **tal cual** el bloque del plan (no renombrar campos: `lockedReason`, `chosenLabel`, `feedbackEnabled`, `feedbackSent`, `notFound`, `theme`, etc.).
2. **`engineContext.ts`**: `createRuntimeEngineContext(): EngineContext` con `rng: Math.random`, `now: () => new Date().toISOString()`, `newId: () => crypto.randomUUID()` (fallback seguro). Es **el único lugar** del módulo, junto con `infrastructure/identity.ts`, que usa azar/reloj.
3. **`useNarrativeContent(slug)`**: envuelve `useUniverseContentQuery` y devuelve `{ content, isLoading, error, notFound }` (`notFound` ⇔ el error es `UnknownUniverseError`).
4. **`useCurrentUser()`**: `{ userId: getLocalUserId(), isAnonymous: true, status: "ready" }`. Seguro en SSR (`getLocalUserId` devuelve un id en memoria si no hay `window`).
5. **`viewModels.ts`** (puras; todas reciben `locale`):
   - `buildParameterViews(content, session, parametersBefore?)` — solo activos, en el orden de `content.parameters`; `ratio = (value-min)/(max-min)`; `delta` = valor actual − `parametersBefore[id]` si hay resolución previa y el valor cambió (si no, `null`); `risk = getThresholdRisk(...)`.
   - `buildPowerViews`, `buildStageView(content, session)` (`total = content.stages.length`).
   - `buildCardView(card, content, session, locale)`: `media` solo si hay `assetId` (resuelve `MediaAsset` → `MediaView` con `alt` localizado); `speaker` si hay `characterId` (nombre, título y retrato); la UI decide qué pintar (prioridad: asset > retrato > solo texto). `options` desde `listOptions` (`locked` incluye `lockedReason`: "Requiere: {nombre del poder}", localizado).
   - `buildOutcomeView(card, optionId, events, session, content, locale)`: `chosenLabel`, `outcomeText`, `events: EventView[]` (mapeo abajo), `ended = session.status !== "active"`, `result`.
   - `buildEndView(content, session, locale)`: usa `endingFor(content.game, session.endingKey)`; si no hay final definido, textos genéricos por `outcome`; `result` incluye `"abandoned"`.
   - `buildIconViews(content, locale)`: `Record<ID, IconView>` con `label = localize(icon.label, locale)`, `svg` y `semanticTags` (los íconos sin `svg` se incluyen igual; la UI los trata como sin ícono).
   - `buildThemeInput(content, session)`: `{ aesthetic: content.aesthetic, activeOverrides: (aesthetic?.overrides ?? []).filter(o => evaluateCondition(o.when, session, content)) }`. Un override cuya condición lance error se ignora (nunca rompe la partida).
   - **Mapeo `GameEvent → EventView`** (`tone`): `parameter_changed` (gain si `delta>0`, loss si `<0`), `score_changed` (gain/loss), `shield_used` (gain), `threshold_fired` (loss), `power_granted` (gain), `power_consumed` (neutral), `badge_awarded` (gain), `stage_advanced` (gain), `branch_entered/left`, `character_unlocked/locked` (neutral), `parameter_activated/deactivated` (neutral); `card_enqueued`, `cascade_limit_reached` y `game_ended` ⇒ **no generan** `EventView`. El `text` sale ya localizado ("Tesoro +8", "Escudo usado: Guardia", "Nueva etapa: …"). Los textos fijos de la plataforma (p. ej. "Escudo usado", "Nueva etapa") van en `lib/copy.ts`, en español.
6. **`derivePhase.ts`** (pura): `derivePhase({ contentStatus, hydrated, session, lastResolution, hasCurrentCard })` ⇒ `NarrativePhase`: `error` si falló el contenido; `loading` si falta contenido o hidratar; `no_session` si no hay sesión; si hay `lastResolution` ⇒ `outcome`; si la sesión está terminada ⇒ `ended`; si `currentCardId` ⇒ `card`; si no ⇒ `between`.
7. **`transitions.ts`** (puras, sin React): `startNewGameTransition`, `chooseTransition`, `nextTransition`, `abandonTransition` — reciben `(content, session, …, ec)` y devuelven la sesión nueva + `LastResolution`/`impression`. Aquí vive el flujo para poder probarlo con el motor real y semilla fija.
8. **`useUniverseTheme(slug?: string)`**: devuelve `{ theme: ThemeInput; locale?: string }` para que el **layout** pueda tematizar el marco sin llamar a `useNarrativeGame`. Sin `slug` o sin contenido cargado ⇒ `{ theme: { activeOverrides: [] } }`. Con contenido: `buildThemeInput(content, session)` usando la sesión del slot del store (si no hay, sin overrides). `useNarrativeGame` usa este mismo hook internamente (una sola fuente).
9. **`useNarrativeGame(slug, options?)`**:
   - Hidrata el store una vez con `useSavedSessionQuery(userId, game.id)`; deriva `NarrativeGame` con los view models; `hasSavedSession` = sesión **activa** guardada; `feedbackEnabled = false`, `sendFeedback` no-op.
   - `startNewGame()`: `createSession` ⇒ `beginTurn` ⇒ guarda ⇒ `phase: "card"`. Reemplaza cualquier sesión guardada.
   - `choose(optionId)`: ignora si `phase !== "card"`; calcula `responseTimeMs` desde que la carta se mostró (`shownAt` en un `ref` al aparecer la carta); `resolveChoice`; `setSession`, `setResolution({ ..., parametersBefore })`; persiste; llama `FeedbackRepository.recordImpression(impression)` (best-effort, sin `await` bloqueante).
   - `next()`: solo en `outcome`. Limpia `lastResolution`; si la sesión sigue activa ⇒ `beginTurn` y persiste; si terminó ⇒ queda `ended`.
   - `abandon()`: `abandonSession`, persiste, `phase: "ended"`.
   - `retry()`: invalida `universeKeys.content(slug)` y `universeKeys.list()`.
   - Con `autoStartTurn: true` y sesión activa sin carta ⇒ `beginTurn` automático (efecto con guardia para no repetirse en StrictMode).
   - Toda excepción del motor o de un repositorio crítico ⇒ `phase: "error"`; los repositorios best-effort (feedback) nunca rompen la partida.
   - Locale: `resolveLocale(game, navigatorLanguages())` con `navigatorLanguages()` seguro sin `navigator`; expuesto como `locale`.
10. No importar componentes ni CSS.

## Fuera de Alcance

- JSX y estilos (plan `universes-ui`).
- Convertir `ThemeInput` en CSS (plan `universes-ui`).
- Identidad real/auth; feedback real; selector de idioma.

## Verificación

- [ ] `viewModels.test.ts`: parámetros inactivos no aparecen; `ratio`, `delta` y `risk` correctos; opción `hide` no aparece y `show_locked` trae `lockedReason`; asset/retrato/solo texto; mapeo de eventos y tonos; `buildEndView` sin final definido usa texto genérico; fallback de `localize`; `buildThemeInput` y `buildIconViews` (label localizado) — `buildThemeInput` activa el override cuando la condición se cumple y lo ignora si es inválida.
- [ ] `derivePhase.test.ts`: tabla completa de combinaciones (loading/error/no_session/between/card/outcome/ended).
- [ ] `transitions.test.ts`: una partida completa con el fixture `demo-reino` y semilla fija; doble `choose` ignorado; `abandonTransition` deja `abandoned`.
- [ ] `pnpm vitest run --project web src/lab/universes/application`, `pnpm typecheck`, `pnpm lint`.

## Handoff

Produce: `useNarrativeGame`, `useUniverseTheme`, `useNarrativeContent`, `useCurrentUser`, `createRuntimeEngineContext` y todos los view models. Task 12 los monta en las rutas; el plan `universes-ui` los consume.
