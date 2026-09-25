# Task 04: Configuración de experimentos y variantes de reglas

> Parte del plan: `../plan.md` — ver "Experimentos (config JSON)".

## Skill / Capa

`selfplay/core` (TS puro).

## Objetivo

Leer y validar un experimento JSON y expandirlo en la lista determinista de `GameSpec` a
jugar, incluyendo variantes de reglas definidas por datos.

## Depende De

- Task 01. Plan Easy agnóstico: `buildRulesView`, `MovementRuleEngine(config)`, `CURRENT_RULES`,
  `rulesFingerprint`, registro de `ComputerPlayer`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/core/experiment.ts` — crear (+ test).
- `apps/web/src/lab/trymate/selfplay/core/ruleOverrides.ts` — crear (+ test).

## Detalles de Implementación

```ts
export interface BotRef {
  bot: "easy" | "medium" | "hard";
  personality?: string;
  budget?: { kind: "nodes"; n: number };
}
export interface ExperimentConfig {
  name: string;
  games: number;
  seed: number;
  maxPlies: number;
  workers: number | "auto";
  setupModes: Partial<Record<"ALTERNATING" | "HIDDEN" | "RANDOM", number>>;
  opening: { randomPlies: number; epsilon: number };
  swapColors: boolean;
  recordPositions?: boolean;
  matchups: { white: BotRef; black: BotRef; weight: number }[];
  rules: RuleOverride[];
}
export interface RuleOverride {
  variant: string; // "current" o nombre libre
  board?: Partial<{ BOARD_WIDTH: number; BOARD_HEIGHT: number }>;
  rules?: Partial<RulesSource>; // ej. { PLACEMENT_DEPTH: 2, POINTS_TO_WIN: 4 }
  pieces?: Partial<Record<string, Partial<PieceMovementConfig>>>; // parche por tipo (merge profundo)
}
export function parseExperiment(json: unknown, available: readonly string[]): ExperimentConfig; // lanza con lista de errores
export function buildVariant(o: RuleOverride): RuleVariant; // { name, rules, engine }
export function expandGames(
  cfg: ExperimentConfig,
  batchId: string,
  gitSha: string | null,
): GameSpecDescriptor[];
```

- `GameSpecDescriptor` = versión **serializable** de `GameSpec` (sin funciones: `BotRef`s, override,
  seed, setupMode…) para mandarla a workers; `materializeSpec(d): GameSpec` la convierte adentro del worker.
- `expandGames`: reparte `games` entre `rules × matchups` por peso (redondeo por mayor resto),
  si `swapColors` mitad y mitad por color, sortea `setupMode` por pesos con el rng del experimento,
  `seed_i = hash(cfg.seed, i)`, `id = <batchId>-<i>` (6 dígitos). Orden estable → reanudable.
- `parseExperiment` rechaza: bots no registrados (mensaje: "hard no está disponible todavía"),
  budgets por tiempo, `games ≤ 0`, overrides que producen reglas imposibles (probar
  `generateRandomArmy` una vez y reportar el error), pesos negativos.
- `buildVariant`: `buildRulesView` con overrides + `new MovementRuleEngine(mergeDeep(PIECE_MOVEMENT_CONFIG, pieces))`.
  Este módulo **sí** puede importar las constantes (no está en `ai/**`).

## Fuera de Alcance

- Ejecutar partidas (Task 05).

## Verificación

- [ ] `expandGames` es determinista y respeta pesos, colores y cantidad total.
- [ ] Override `{ board: { BOARD_WIDTH: 7, BOARD_HEIGHT: 13 } }` produce el mismo fingerprint que la
      variante `wide-7x13` de `ruleVariants`.
- [ ] Errores claros para cada caso inválido listado.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/selfplay` + `pnpm typecheck`

## Handoff

- Produce: `parseExperiment`, `buildVariant`, `expandGames`, `materializeSpec`.
