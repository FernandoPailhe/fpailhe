# Task 05: Personalidades (ofensivo / defensivo / equilibrado)

> Parte del plan: `../plan.md` — ver "Personalidades".

## Skill / Capa

Application pura (`application/ai/hard/`).

## Objetivo

Definir perfiles de personalidad **como datos** que cambian el estilo de juego de Hard
(qué valora, cuándo ataca o defiende, cómo despliega, cómo desempata) **sin cambiar su nivel**.

## Depende De

- Task 04 (`HardTerm`, evaluación con desglose por bando).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/personality.ts` — crear (tipo compartido, fuera de `hard/`
  para que Medium pueda adoptarlo en el futuro).
- `apps/web/src/lab/trymate/application/ai/hard/personalities.ts` — crear (perfiles Hard).
- `apps/web/src/lab/trymate/application/ai/hard/personalities.test.ts` — crear.

## Detalles de Implementación

`personality.ts`:

```ts
export type Personality = "offensive" | "defensive" | "balanced";
export const PERSONALITIES: readonly Personality[] = ["balanced", "offensive", "defensive"];
```

`hard/personalities.ts`:

```ts
export interface PersonalityProfile {
  id: Personality;
  /** Multiplicadores por término y por bando, aplicados ANTES de la postura. Default 1. */
  selfMul: Partial<Record<HardTerm, number>>; // términos calculados sobre piezas del bot
  oppMul: Partial<Record<HardTerm, number>>; // términos calculados sobre piezas del rival
  posture: { defendZoneDelta: number; attackZoneDelta: number; attackMaterialLeadRatio: number };
  contempt: number; // valor de un final sin ganador (bloqueo mutuo / maxPlies) desde el bot
  tieWindow: number; // ancho de "casi empate" en la raíz para aplicar el estilo
  tieBreak: "progress" | "safety" | "none";
  setup: { frontBias: number; roleTilt: Partial<Record<PieceRole, number>> };
}
export const PERSONALITY_PROFILES: Record<Personality, PersonalityProfile>;
export function getPersonalityProfile(p: Personality): PersonalityProfile;
```

Valores iniciales (ajustables solo en este archivo):

| Campo                                     | balanced | offensive                              | defensive                              |
| ----------------------------------------- | -------- | -------------------------------------- | -------------------------------------- |
| `selfMul.progress`                        | 1        | 1.35                                   | 0.85                                   |
| `selfMul.freeLane`                        | 1        | 1.5                                    | 0.9                                    |
| `selfMul.race`                            | 1        | 1.3                                    | 1                                      |
| `selfMul.hanging` (riesgo propio)         | 1        | 0.8                                    | 1.3                                    |
| `selfMul.cohesion`                        | 1        | 0.85                                   | 1.3                                    |
| `oppMul.progress` (miedo al avance rival) | 1        | 0.9                                    | 1.35                                   |
| `oppMul.race`                             | 1        | 1                                      | 1.3                                    |
| `selfMul.containment` (frenar al rival)   | 1        | 0.75                                   | 1.5                                    |
| `selfMul.runnerThreat`                    | 1        | 0.8                                    | 1.5                                    |
| `posture.defendZoneDelta`                 | 0        | −1                                     | +1                                     |
| `posture.attackZoneDelta`                 | 0        | +1                                     | −1                                     |
| `posture.attackMaterialLeadRatio`         | 0.8      | 0.5                                    | 1.2                                    |
| `contempt`                                | 0        | −60                                    | +30                                    |
| `tieWindow`                               | 1        | 8                                      | 8                                      |
| `tieBreak`                                | none     | progress                               | safety                                 |
| `setup.frontBias`                         | 0        | +6                                     | −4                                     |
| `setup.roleTilt`                          | —        | runner +1, attacker +0.5, blocker −0.5 | blocker +1, attacker +0.5, runner −0.5 |

Semántica (la aplican las tareas consumidoras; acá solo se define y documenta):

- **Evaluación (Task 04, ya soporta `SideMultipliers`):** se pasa `{ selfMul, oppMul }` del perfil;
  `término = selfMul[t] × F_bot[t] − oppMul[t] × F_rival[t]`; `containment` y `runnerThreat` van en `selfMul`.
- **Postura (Task 06):** `runnerZone` para DEFEND = `runnerZone + defendZoneDelta`; para ATTACK =
  `runnerZone + 1 + attackZoneDelta`; ventaja material requerida = `attackMaterialLeadRatio × valorMedio`.
- **Contempt (Task 06):** nodos sin ganador por bloqueo mutuo valen `contempt` (no 0).
  Ofensivo evita tablas; defensivo las acepta si va perdiendo.
- **Desempate (Task 06):** entre jugadas raíz con `score ≥ best − tieWindow`: `progress` → mayor
  aumento de progreso propio; `safety` → menor cantidad de piezas propias atacadas tras la jugada;
  `none` → `rng`. Mantiene la fuerza (solo elige entre casi-iguales) y hace visible el estilo.
- **Setup (Task 09):** `frontBias` suma a candidatos con más piezas en filas delanteras;
  `roleTilt` sesga `targetComposition` (± piezas por rol, respetando `feasibleTypes`).

## Fuera de Alcance

- Personalidades para Easy/Medium (el tipo queda compartido para hacerlo luego).
- Ajuste automático de multiplicadores (ver Task 10, opcional).

## Verificación

- [ ] `getPersonalityProfile` devuelve los 3 perfiles; `balanced` es neutro (todos 1, contempt 0, tieWindow 1).
- [ ] Ningún perfil referencia tipos de pieza concretos (solo roles y términos) — lint del plan agnóstico.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard` + `pnpm typecheck`

## Handoff

- Produce: `Personality`, `PersonalityProfile`, `getPersonalityProfile` para Tasks 04, 06, 07, 09–13.
