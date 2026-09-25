# Task 02: Información de decisión estándar en los bots

> Parte del plan: `../plan.md` — ver `PlyRecord.decision`.

## Skill / Capa

`application/ai/` (bots).

## Objetivo

Que cualquier bot pueda contar, de forma uniforme, qué evaluó en su última decisión
(evaluación, profundidad, nodos, tiempo, postura, mejores alternativas), para guardarlo.

## Depende De

- `ComputerPlayer` (plan Easy agnóstico).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/ComputerPlayer.ts` — agregar tipo y método opcional.
- `apps/web/src/lab/trymate/application/ai/EasyBot.ts` — implementar.
- `MediumBot.ts` / `hard/HardBot.ts` — implementar **si existen** (si no, sus planes lo harán: agregar
  una línea en sus Task de fachada remitiendo a este contrato).
- Tests de cada bot tocado.

## Detalles de Implementación

```ts
export interface DecisionInfo {
  eval?: number; // desde el punto de vista del bot que decidió
  depth?: number;
  nodes?: number;
  ms?: number;
  posture?: string;
  personality?: string;
  top?: { action: BotPlayAction; score: number }[]; // hasta 5, ordenadas desc
}
export interface ComputerPlayer {
  // …existente…
  getLastDecisionInfo?(): DecisionInfo | null;
}
```

- **Easy:** guardar los candidatos puntuados de la última `choosePlayAction`: `top` = 5 mejores
  (`score` = su puntaje heurístico), `eval` = puntaje de la elegida, `nodes` = cantidad de candidatos.
- **Medium:** desde `lastDecision` (postura, depth, nodes, top).
- **Hard:** desde `lastResult` (score, depth, nodes, ms, pv/top, personalidad).
- `ms` solo con `performance.now()` (no afecta determinismo de la jugada).

## Fuera de Alcance

- Serializar (Task 03).

## Verificación

- [ ] Tras `choosePlayAction`, `getLastDecisionInfo()` no es `null` y `top[0]` coincide con la acción elegida
      cuando no hubo azar (Easy con `randomMoveChance = 0`).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai` + `pnpm typecheck`

## Handoff

- Produce: `DecisionInfo` y `getLastDecisionInfo` en los bots disponibles.
