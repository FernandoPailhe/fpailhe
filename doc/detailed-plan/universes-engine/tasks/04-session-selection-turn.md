# Task 04: Sesión, opciones, selección de carta, etapas y ciclo de turno

> Parte del plan: `../plan.md` — **leer "Reglas del motor" #1, #9, #10, #11, #12, #13** y "Contrato del motor". Este task implementa `createSession`, `abandonSession`, `listOptions`, `beginTurn` y `resolveChoice`.

## Skill / Capa

`add-feature` paso 1 (funciones puras en `domain/` del módulo).

## Objetivo

Completar el motor: crear la sesión, listar opciones, elegir la próxima carta con relajación progresiva, resolver una decisión de punta a punta (efectos → thresholds → personajes → etapa → historial → impression) y abandonar.

## Depende De

- Task 03: `applyEffects`, `settleThresholds`.
- Task 02: `evaluateCondition`, helpers de test.

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/domain/engine/session.ts` — crear (`createSession`, `abandonSession`)
- `apps/web/src/lab/universes/domain/engine/options.ts` — crear (`listOptions`)
- `apps/web/src/lab/universes/domain/engine/selection.ts` — crear (`isCardEligible`, `selectNextCard`, `beginTurn`)
- `apps/web/src/lab/universes/domain/engine/stages.ts` — crear (`advanceStageIfReady`, `unlockCharactersByCondition`)
- `apps/web/src/lab/universes/domain/engine/turn.ts` — crear (`resolveChoice`)
- `apps/web/src/lab/universes/domain/engine/weights.ts` — **solo el stub** `computeEffectiveWeight(card, stats) => stats?.effectiveWeight ?? card.baseWeight` (Task 05 lo reemplaza por la fórmula real)
- Tests: `session.test.ts`, `options.test.ts`, `selection.test.ts`, `stages.test.ts`, `turn.test.ts`
- `engine/index.ts` — editar (exportar las funciones públicas del contrato)

## Detalles de Implementación

**`createSession(content, { userId, locale }, ec)`** — completar todos los campos de `GameSession`:
`id: ec.newId()`, `schemaVersion: NARRATIVES_SCHEMA_VERSION`, `createdAt/updatedAt/startedAt: ec.now()`, `status: "active"`, `locale`, `turn: 0`, `score: 0`, `stageId` = etapa de menor `order`, `branchIds = [...config.initialBranchIds]`, `parameters[p.id] = p.initialValue` para **todos** los parámetros, `activeParameterIds = [...config.initialActiveParameterIds]`, `unlockedCharacterIds = config.initialUnlockedCharacterIds ∪ {characters con unlockedByDefault}`, `powers = (config.initialPowers ?? []).map(copy)`, `flags: {}`, `earnedBadgeIds: []`, `cardHistory: {}`, `cardQueue: []`, `firedThresholdIds: []`. Luego "entrar" a la etapa inicial: `activatesParameterIds` (como `activate_parameter`) + `onEnter` vía `applyEffects` + `settleThresholds`. Devuelve **solo la sesión**.

**`abandonSession(session, ec)`**: `status: "abandoned"`, `endedAt`, `currentCardId: undefined`.

**`listOptions(card, session, content)`**: regla 10. Ordenar por `order`.

**`isCardEligible(card, session, content, level: RelaxationLevel)`** (regla 9). Definir los 5 niveles con una tabla interna (`ignoreRecent`, `ignoreCooldown`, `widenDifficulty`, `ignoreStageAndDifficulty`) — no `if` anidados. Recordar: la etapa actual se obtiene de `content.stages` por `session.stageId`; `once`/`maxPerSession` **no** se relajan nunca.

**`selectNextCard(content, session, stats, ec)`**: devuelve `{ card, relaxation } | null`. Para cada nivel 0→4 construir el pool; si no está vacío, sorteo ponderado: `weights = pool.map(c => Math.max(0, computeEffectiveWeight(c, stats[c.id])))`; si `sum === 0` → uniforme; `r = ec.rng() * sum` y recorrer acumulando.

**`beginTurn(content, session, stats, ec)`**:
1. `cardQueue`: ordenar por `dueTurn` (estable) y tomar la primera con `dueTurn <= session.turn`; sacarla de la cola; ignorarla (y probar la siguiente) si ya no está en `content.cards` o `listOptions` no tiene ninguna `available`. Si se usó: `relaxation: "forced"`.
2. Si no, `selectNextCard`. Si devuelve `null`: sesión `status: "lost"`, `endingKey: "no_cards"`, `endedAt` y `card: null` (`BeginTurnResult` no lleva eventos: la UI deriva el final de `session.status`).
3. Setear `currentCardId`. `updatedAt`.

**`resolveChoice(content, session, input, ec)`** — orden **exacto** de la regla 1:
1. Validar: la sesión está `active` y `currentCardId` existe; la carta existe; la opción existe y su estado es `available` → si no, `throw new Error(...)` con mensaje claro.
2. `applyEffects(option.effects, { threatTags: option.threatTags })`.
3. Si sigue `active`: `settleThresholds(..., { threatTags: option.threatTags })`.
4. Si sigue `active`: `unlockCharactersByCondition` (para cada personaje bloqueado con `unlockCondition` verdadera → `unlock_character`).
5. Si sigue `active`: `advanceStageIfReady` (una etapa; regla 11): al avanzar → `stageId`, `activatesParameterIds` + `onEnter` con `applyEffects`, luego `settleThresholds` de nuevo; evento `stage_advanced`.
6. Historial: `cardHistory[cardId] = { count: (prev ?? 0) + 1, lastTurn: session.turn, lastOptionId: optionId }`.
7. `turn += 1`, `currentCardId = undefined`, `updatedAt`.
8. `impression`: `{ id: ec.newId(), gameId, cardId, sessionId: session.id, userId, turn: <turno de la carta>, stageId: <etapa antes>, branchIds: <antes>, shownAt: input.shownAt, chosenOptionId, responseTimeMs, parametersBefore, parametersAfter, causedGameOver: (después.status === "lost" && antes.status === "active"), shieldUsedPowerId: <primer evento shield_used>, availableOptionIds: <ids de listOptions available> }`.
9. Devolver `{ session, events, impression, chosenOption }`. Los eventos van en orden cronológico concatenados de cada paso.

## Fuera de Alcance

- No implementar validación de contenido ni la fórmula de pesos real (Task 05).
- No leer `localStorage`, ni red, ni React.
- No agregar campos a `GameSession` (el "reciente" se deriva de `cardHistory`).

## Verificación

- [ ] Tests (con `createSeededRng` y `createSequentialId`): `createSession` (inicial correcto, `onEnter` aplicado, desbloqueados por default); `listOptions` (hide vs show_locked, `unlockTag` con y sin poder, orden); selección: rama global vs rama específica, `minStageOrder/maxStageOrder`, rango de dificultad, `once` no repite, `repeatable` con `cooldownTurns` y `maxPerSession`, ventana de recientes, personaje bloqueado, carta forzada de cola con `dueTurn`, cola con carta inválida se descarta, **cada nivel de relajación** (y que `once` no se relaja), pool vacío → `no_cards`; `resolveChoice`: orden de pasos, derrota por threshold, shield evita la derrota, avance de etapa activa parámetros y cambia dificultad, desbloqueo de personaje por condición, impression correcta, opción bloqueada → throw, inmutabilidad; **determinismo**: mismo seed + mismas elecciones ⇒ misma secuencia de cartas.
- [ ] `pnpm vitest run --project web src/lab/universes/domain` y `typecheck`.

## Handoff

Produce: el contrato completo del motor excepto validación/pesos. Task 05 completa `weights.ts`; Task 11 consume `createSession/beginTurn/resolveChoice/listOptions/abandonSession`.
