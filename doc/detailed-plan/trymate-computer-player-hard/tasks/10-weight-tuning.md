# Task 10: Ajuste de pesos por auto-juego (SPSA, solo dev)

> Parte del plan: `../plan.md` — ver principio 4 y "Supuestos" (se corre a mano).

## Skill / Capa

Herramienta de desarrollo en `application/ai/testing/` (no se incluye en el build).

## Objetivo

Encontrar pesos de evaluación mejores que los escritos a mano jugando Hard contra sí mismo, y
poder repetirlo cada vez que cambien las reglas.

## Depende De

- Task 06 (`searchHard` modo nodos). Del plan Easy agnóstico / Medium: `arena.ts`, `ruleVariants`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/testing/tuneHard.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/testing/tuneHard.run.test.ts` — crear (entrada vía vitest).
- `apps/web/src/lab/trymate/application/ai/hard/weights.json` — se sobrescribe con el resultado.

## Detalles de Implementación

```ts
export interface TuneOptions {
  iterations: number;
  gamesPerIteration: number;
  nodesPerMove: number;
  seed: number;
  a: number;
  c: number;
}
export function tuneHardWeights(
  start: Record<HardTerm, number>,
  variant: RuleVariant,
  opts: TuneOptions,
  onProgress?: (it: number, w: Record<HardTerm, number>) => void,
): Record<HardTerm, number>;
```

- **SPSA:** en cada iteración `k`, perturbación aleatoria `Δ ∈ {−1, +1}^n`,
  `c_k = c / (k+1)^0.101`, `a_k = a / (k+1+10)^0.602`. Jugar `gamesPerIteration` partidas
  `w + c_k·Δ` vs `w − c_k·Δ` (colores alternados, mismas semillas) con la arena en modo nodos.
  `g = (winsPlus − winsMinus) / gamesPerIteration`. `w ← w + a_k · g · Δ` (en espacio log para
  que los pesos queden > 0: operar sobre `log w`).
- Defaults: `iterations 200`, `gamesPerIteration 8`, `nodesPerMove 4 000`, `a 0.5`, `c 0.1`.
- Guardar cada 10 iteraciones (checkpoint) para poder cortar y retomar.
- **Personalidades:** se ajustan los pesos **base** jugando `balanced` vs `balanced`; los
  multiplicadores de personalidad (Task 05) quedan fijos. Tras ajustar, correr el chequeo de
  paridad: cada personalidad vs `balanced` en 40 partidas debe quedar entre 40 % y 60 % de
  victorias. Si no, reportar cuál y por cuánto (ajuste manual de `personalities.ts`).
- Opcional (flag `--personality`): SPSA sobre los multiplicadores de una personalidad con objetivo
  `winrate + λ × métricaDeEstilo` (λ = 0.3; métrica de Task 13) para que no pierda su estilo.
- Al terminar: validar el resultado vs pesos iniciales en 40 partidas; escribir `weights.json`
  solo si gana ≥ 55 %, con `fingerprint = rulesFingerprint(variant.rules, variant.engine.config)`,
  `tunedAt` y `games`.
- Entrada: `tuneHard.run.test.ts` con `describe.skipIf(!process.env.TRYMATE_TUNE)` y timeout alto;
  escribe el archivo con `node:fs` (permitido en tests).

## Fuera de Alcance

- Correr el tuning en CI. Ajustar pesos de Easy o Medium.

## Verificación

- [ ] Test unitario del paso SPSA con una "arena" falsa determinista (función objetivo conocida):
      converge hacia el óptimo en ≤ 50 iteraciones.
- [ ] `TRYMATE_TUNE=1 pnpm exec vitest run apps/web/src/lab/trymate/application/ai/testing/tuneHard.run.test.ts`
      con `iterations: 5` como humo: escribe checkpoint y termina.
- [ ] `grep -rn "testing/tuneHard" apps/web/src --include=*.ts | grep -v "\.test\.ts"` vacío (no llega al build).
- [ ] `pnpm typecheck`

## Handoff

- Produce: script de tuning + `weights.json` ajustado (correrlo completo antes de cerrar el plan).
