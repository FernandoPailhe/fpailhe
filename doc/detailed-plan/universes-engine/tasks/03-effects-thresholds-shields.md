# Task 03: Efectos, thresholds, shields y riesgo

> Parte del plan: `../plan.md` — **leer "Reglas del motor" #2–#8 antes de empezar**; este task las implementa literalmente.

## Skill / Capa

`add-feature` paso 1 (funciones puras en `domain/` del módulo).

## Objetivo

Implementar `applyEffects`, `settleThresholds`, `getThresholdRisk` y el manejo de shields/cascada, con tests exhaustivos. Es el corazón del motor.

## Depende De

- Task 02: `evaluateCondition`, helpers de test.

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/domain/engine/effects.ts` — crear
- `apps/web/src/lab/universes/domain/engine/thresholds.ts` — crear
- `apps/web/src/lab/universes/domain/engine/risk.ts` — crear
- `apps/web/src/lab/universes/domain/engine/effects.test.ts`, `thresholds.test.ts`, `risk.test.ts` — crear
- `apps/web/src/lab/universes/domain/engine/index.ts` — editar (exportar `applyEffects`, `settleThresholds`, `getThresholdRisk`)

## Detalles de Implementación

Firmas internas (exportadas para el task 04 y para tests):

```ts
export interface EffectRun { session: GameSession; events: GameEvent[] }

export function applyEffects(
  content: GameContent,
  session: GameSession,
  effects: readonly Effect[],
  ec: EngineContext,
  opts?: { threatTags?: readonly string[] },   // tags de la opción elegida (regla 4)
): EffectRun;

export function settleThresholds(
  content: GameContent,
  session: GameSession,
  ec: EngineContext,
  opts?: { threatTags?: readonly string[] },
): EffectRun;                                   // ya incluye cascada y tope MAX_CASCADE_DEPTH
```

- **Inmutabilidad**: ambas clonan la sesión de entrada (`structuredClone`) y devuelven la nueva; nunca mutan el argumento. Cada efecto actualiza `updatedAt = ec.now()` una sola vez al final.
- **Cada `Effect`** (switch exhaustivo con `never`):
  - `modify_parameter`: aplica modifiers (regla 7: `Math.round(delta × Π multiplier)`), clamp a `[min,max]`, evento `parameter_changed` solo si el valor cambió. Parámetro desconocido → ignorar. Parámetro **inactivo**: sí actualiza el valor (regla 8 del plan) pero no dispara thresholds.
  - `set_parameter`: clamp; evento si cambió.
  - `activate_parameter` / `deactivate_parameter`: edita `activeParameterIds` sin duplicar; evento solo si hubo cambio.
  - `add_score`: suma; evento `score_changed` si `points !== 0`.
  - `set_flag`.
  - `enter_branch`: agrega sin duplicar; si la rama tiene `exclusiveGroup`, saca las demás del mismo grupo (evento `branch_left` por cada una) y emite `branch_entered`. `leave_branch`: saca y emite.
  - `unlock_character` / `lock_character`: edita `unlockedCharacterIds`; evento si cambió.
  - `grant_power`: `charges ?? 1`; suma a la entrada existente o crea; respeta `maxCharges` (tope); evento `power_granted` con las cargas **resultantes**. `consume_power`: resta (`charges ?? 1`, mínimo 0); si queda en 0 se elimina la entrada; evento `power_consumed` con las cargas restantes; si no la tiene → no-op.
  - `award_badge`: agrega a `earnedBadgeIds` si no estaba; evento.
  - `enqueue_card`: `cardQueue.push({ cardId, dueTurn: session.turn + (delayTurns ?? 1) })`; evento.
  - `end_game`: **primero** buscar shield (regla 4/5) con tags `effect.threatTags ∪ opts.threatTags`; si absorbe → `shield_used` y no hace nada más. Si no, `status = outcome === "victory" ? "won" : "lost"`, `endingKey`, `endedAt = ec.now()`, evento `game_ended`, y **cortar** el resto de efectos de la lista (regla 2).
- **Shield** (helper interno `tryAbsorbWithShield(session, tags)`): candidatos = `session.powers` cuyo `Power` (buscar en `content.powers`) es `kind: "shield"` con `blocksThreatTags` que intersecta `tags` y `charges ≥ 1`; elegir el de menos cargas (desempate: orden en `session.powers`); aplicar `consume_power` de 1 carga; devolver `powerId | undefined`.
- **`settleThresholds`** (reglas 3, 5, 6):
  - Ronda: recorrer `content.parameters` en orden, y por cada parámetro **activo** sus `thresholds` en orden; un threshold "se cumple" si `lte`: `valor <= value`, `gte`: `valor >= value`.
  - Saltar si `once` y está en `firedThresholdIds`, y saltar si ya se disparó **en esta llamada** (set local `firedThisCall`).
  - Tags efectivos = `threshold.threatTags ∪ opts.threatTags`. Si un shield absorbe: `shield_used` (con `parameterId`), mover el parámetro a su valor seguro (`SHIELD_RECOVERY_RATIO`, ver regla 5), **no** marcar como disparado ni ejecutar efectos.
  - Si no hay shield: evento `threshold_fired`, agregar a `firedThresholdIds` si `once`, ejecutar `threshold.effects` con `applyEffects` (pasando los mismos `opts`).
  - Si en la ronda se disparó/absorbió algo y el juego sigue `active`, repetir otra ronda (los efectos pueden haber hecho cumplir otros thresholds). Tope `ENGINE_CONFIG.MAX_CASCADE_DEPTH` rondas: al excederlo emitir `cascade_limit_reached` y cortar. Si `status !== "active"` cortar de inmediato.
- **`getThresholdRisk(parameter, value, ratio = ENGINE_CONFIG.THRESHOLD_RISK_RATIO)`**: `range = max − min`; devuelve `"low"` si existe un threshold `lte` con `value ≤ threshold.value + ratio·range` (y aún no cumplido o igual), `"high"` si existe un `gte` con `value ≥ threshold.value − ratio·range`; si se cumplen ambos, el más cercano; si ninguno, `null`. Solo considera thresholds cuyo extremo esté dentro de `[min,max]`.

## Fuera de Alcance

- No elegir cartas, no armar sesiones, no avanzar etapas (Task 04).
- No tocar `ValidationIssue` ni validación (Task 05).

## Verificación

- [ ] Tests (mínimos, con `makeSession/makeContent`): clamp en 0 y 100; modifier positivo/negativo/`both`/por `parameterId`; `grant_power` respeta `maxCharges`; `consume_power` a 0 elimina la entrada; rama exclusiva saca a la hermana; `enqueue_card` calcula `dueTurn`; `end_game` corta los efectos siguientes; `end_game` absorbido por shield (con y sin tags de opción); threshold `lte 0` sin shield → derrota; con shield → carga −1, sin derrota, parámetro reposicionado a `threshold + round(0.1·range)` y **sin re-disparo** en la siguiente llamada; threshold `once` no repite; threshold sin `once` no se dispara dos veces en la misma llamada; parámetro inactivo no dispara; cascada que excede el tope emite `cascade_limit_reached`; inmutabilidad (la sesión original no cambia, `Object.freeze` profundo en el test); `getThresholdRisk` (low/high/null/ratio custom).
- [ ] `pnpm vitest run --project web src/lab/universes/domain` y `typecheck`.

## Handoff

Produce: `applyEffects`, `settleThresholds`, `getThresholdRisk`, y el helper interno de shields reutilizable por `stages.ts` en Task 04.
