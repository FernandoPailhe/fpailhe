# Plan: TryMate — Auto-juego y estadísticas de partidas (Opción 1)

## Objetivo

Correr miles de partidas bot vs bot en la Mac mini (sin navegador, usando todos los núcleos),
guardar cada partida en un formato versionado y generar reportes que respondan preguntas de
**diseño del juego**: ¿hay ventaja por mover primero?, ¿qué composiciones y piezas ganan más?,
¿alguna pieza está desbalanceada?, ¿cuánto duran las partidas?, ¿cómo rinden las personalidades?
y, sobre todo, **¿qué pasaría si cambio una regla?** (probar variantes de reglas antes de
implementarlas en la UI).

Todo gratis: Node + el propio código del juego; DuckDB opcional para exploración ad-hoc. Los
datos quedan listos para, más adelante, entrenar una red (opción 2) sin re-generarlos.

## Fuente de Requerimientos

- Pedido del usuario: "correr partidas entre hard vs hard para almacenar información importante
  sobre la dinámica del juego y los resultados" → "arrancar con la opción 1 (estadísticas)".
- **Precondiciones:** `trymate-rules-agnostic-easy` implementado (RulesView/`buildRulesView`,
  motor configurable, `SimState`, `arena.ts`, `ruleVariants`, `ComputerPlayer`, `generateRandomArmy`).
  Medium y Hard **no** son requisito: el runner usa los bots registrados; Hard y sus
  personalidades se habilitan solos cuando existan (`trymate-computer-player-medium`, `-hard`).
- Reglas del repo: `.devin/rules/rules.md` (stack fijo; nueva dependencia solo con justificación).

## Decisiones de diseño

### Dónde vive el código

```
apps/web/src/lab/trymate/selfplay/
  core/        # TS puro, sin Node ni DOM: esquema, grabador, experimentos, agregación, reporte
  node/        # CLI, pool de worker_threads, lectura/escritura de archivos (solo Node)
  experiments/ # presets JSON versionados
  duckdb/      # consultas SQL de ejemplo (opcional)
```

- Nada de la app importa `selfplay/` (test de guarda + lint): **no entra al bundle web**.
- `node/` se excluye del `tsconfig.json` de la app y tiene su propio `tsconfig.selfplay.json`
  con tipos de Node. Nueva devDependency: `@types/node` (justificación: tipado de
  `fs`/`zlib`/`worker_threads`; sin runtime).
- **Ejecución:** se empaqueta con Vite (ya en el stack) en modo SSR a
  `apps/web/.selfplay-dist/` (gitignored) y se corre con `node`. Sin `tsx`/`ts-node`.

### Dónde viven los datos

- Default `~/TryMateData/selfplay/` (fuera del repo), configurable con `--out`. Nunca se commitean.
- Un **batch** = una ejecución de un experimento:

```
<out>/<YYYYMMDD-HHmm>-<experimentName>-<shortId>/
  manifest.json            # config, git sha, fingerprint(s), versiones de bots, contadores, tiempos, estado
  games-000.jsonl.gz       # partidas (1 por línea), shards de 1 000 partidas
  games-001.jsonl.gz
  summary.json             # agregados (Task 05)
  report.md                # reporte legible (Task 06)
```

### Registro de partida (`trymate.game/1`)

```ts
export interface GameRecord {
  schema: "trymate.game/1";
  id: string;
  batchId: string;
  seed: number;
  createdAt: string;
  gitSha: string | null;
  rules: {
    fingerprint: string;
    variant: string;
    view: RulesViewSnapshot;
    pieceConfig: PieceMovementConfigMap;
  };
  players: Record<Player, PlayerSpec>; // bot, dificultad, personalidad, presupuesto, configHash
  setupMode: "ALTERNATING" | "HIDDEN" | "RANDOM";
  setup: Record<
    Player,
    { board: { type: PieceType; x: number; y: number }[]; bench: PieceType[]; order: number[] }
  >;
  opening: { randomPlies: number; epsilon: number; randomActions: number[] }; // índices de plies con jugada aleatoria
  plies: PlyRecord[];
  result: {
    winner: Player | null;
    scores: Record<Player, number>;
    reason: "points" | "blocked" | "maxPlies";
    plies: number;
    durationMs: number;
  };
  metrics: Record<Player, SideMetrics>;
}
export interface PlyRecord {
  n: number;
  player: Player;
  kind: "move" | "bench" | "pass";
  pieceId?: string;
  type?: PieceType;
  from?: [number, number];
  to?: [number, number];
  capture?: PieceType;
  scored?: boolean;
  random?: boolean;
  decision?: {
    eval?: number;
    depth?: number;
    nodes?: number;
    ms?: number;
    posture?: string;
    top?: { a: string; s: number }[];
  };
  pos?: string; // posición ANTES de la acción, codificada compacta (Task 01)
}
```

- `pos` (posición compacta) va **por defecto** porque habilita la opción 2 sin re-jugar;
  se puede apagar con `--no-positions`.
- `SideMetrics` = métricas de estilo del plan Hard (Task 13): `avgFrontProgress`,
  `pliesToFirstScore`, `capturesMade`, `piecesLost`, `opponentMaxProgress`, `benchDrops`, …
- Estimación: ~25 KB por partida sin comprimir, ~4 KB en gzip → 100 000 partidas ≈ 400 MB.

### Experimentos (config JSON)

```json
{
  "name": "balance-baseline",
  "games": 2000,
  "seed": 1,
  "maxPlies": 400,
  "workers": "auto",
  "setupModes": { "ALTERNATING": 1, "HIDDEN": 1, "RANDOM": 0 },
  "opening": { "randomPlies": 4, "epsilon": 0.15 },
  "swapColors": true,
  "matchups": [
    {
      "white": {
        "bot": "hard",
        "personality": "balanced",
        "budget": { "kind": "nodes", "n": 20000 }
      },
      "black": {
        "bot": "hard",
        "personality": "balanced",
        "budget": { "kind": "nodes", "n": 20000 }
      },
      "weight": 1
    }
  ],
  "rules": [{ "variant": "current" }]
}
```

- `rules` acepta variantes con overrides (tablero, `GAME_RULES`, parches al config de piezas)
  → **laboratorio de reglas**: se comparan batches por `variant`/fingerprint.
- **Diversidad** (sin esto Hard vs Hard repite partidas): semilla por partida, modo de setup
  sorteado (`RANDOM` = ambos ejércitos con `generateRandomArmy`, válido con cualquier regla),
  setups generados por los propios bots, y en los primeros `randomPlies` cada jugada
  tiene probabilidad `epsilon` de ser una jugada legal al azar (marcada `random: true`).
- **Presupuesto por nodos** siempre (determinismo y velocidad); nunca por tiempo.
- `swapColors`: cada matchup se juega con ambos colores en igual cantidad.

### Estadísticas (qué responde el reporte)

| Pregunta                                      | Métrica                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ¿Ventaja por mover primero?                   | % victorias BLANCAS vs NEGRAS con intervalo de Wilson 95 %                                                                        |
| ¿Cuánto dura una partida? ¿Cuántas se traban? | Distribución de plies; % `blocked`, % `maxPlies`                                                                                  |
| ¿Qué composición gana?                        | Win rate por composición (conteo por tipo en tablero + banca) y por forma del despliegue (piezas en fila delantera/media/trasera) |
| ¿Alguna pieza desbalanceada?                  | Por tipo: supervivencia, capturas hechas/sufridas, **matriz captor→víctima**, puntos anotados, plies hasta anotar                 |
| ¿Dónde pasa la acción?                        | Heatmaps por casilla: ocupación, capturas, columnas por donde se anota                                                            |
| ¿La banca importa?                            | Momento y tipo de bajadas; win rate según cantidad de bajadas                                                                     |
| ¿Quien anota primero gana?                    | % remontadas                                                                                                                      |
| ¿Personalidades?                              | Matriz de enfrentamientos; métricas de estilo promedio por personalidad                                                           |
| ¿Qué tan bien evalúa el bot?                  | Calibración: eval en el ply k vs resultado final (útil para opción 2)                                                             |
| ¿Qué cambia una regla?                        | `compare`: diferencias entre batches con CI y marca de significancia                                                              |

Reglas estadísticas: mostrar siempre `n`; marcar ⚠ si `n < 200` en una celda; diferencias
"significativas" solo si los intervalos de Wilson 95 % no se solapan.

## Pantallas / Componentes

Ninguna en la web por ahora (salida = `report.md` + `summary.json`). Una página
`/lab/trymate/stats` que lea `summary.json` queda como mejora futura.

## Secuencia de Implementación

| #   | Task file                      | Capa                  | Depende de |
| --- | ------------------------------ | --------------------- | ---------- |
| 1   | tasks/01-record-schema.md      | selfplay/core         | —          |
| 2   | tasks/02-decision-info.md      | ai (bots)             | —          |
| 3   | tasks/03-game-recorder.md      | selfplay/core         | 1, 2       |
| 4   | tasks/04-experiments.md        | selfplay/core         | 1          |
| 5   | tasks/05-node-runner.md        | selfplay/node + build | 3, 4       |
| 6   | tasks/06-aggregations.md       | selfplay/core + node  | 1          |
| 7   | tasks/07-report-compare.md     | selfplay/core + node  | 6          |
| 8   | tasks/08-presets-duckdb.md     | experiments + duckdb  | 4, 6       |
| 9   | tasks/09-final-verification.md | verificación          | all        |

Paralelizable: 1 y 2 desde el inicio; 4 y 6 en paralelo después de 1.

## Criterios de Aceptación Globales

- [ ] `pnpm trymate:selfplay --config <preset>` corre con N workers, muestra progreso, se puede
      cortar con Ctrl+C y **retomar** sin duplicar partidas.
- [ ] Cada partida grabada se puede **re-jugar** desde su registro y llega al mismo resultado (test).
- [ ] Mismo experimento + misma semilla → mismos resultados (determinismo).
- [ ] `pnpm trymate:report <batch>` genera `summary.json` + `report.md` con todas las métricas de la tabla.
- [ ] `pnpm trymate:compare <batchA> <batchB>` muestra diferencias con CI.
- [ ] Un preset con reglas alternativas (ej. 7×13) corre sin tocar el código del juego.
- [ ] Nada de `selfplay/` entra al bundle web (test de guarda + build sin cambios de tamaño).
- [ ] Rendimiento en la Mac mini M4 documentado (partidas/hora por matchup) en el README del módulo.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pasan. Cero `any`.

## Preguntas Abiertas / Supuestos

- **Supuesto:** ~20 000 nodos por jugada para Hard en datos (≈ 10× más rápido que en juego) da
  partidas representativas; se puede subir en presets específicos.
- **Supuesto:** la carpeta de datos por defecto es `~/TryMateData`; si preferís el disco
  externo (`/Volumes/1TB-External/...`), se pasa `--out` o se define `TRYMATE_DATA_DIR`.
- **Supuesto:** partidas humanas **no** se registran en este plan (requiere consentimiento y
  backend); el formato ya lo soportaría (`players[x].bot = "human"`).
- **Abierto:** página web de estadísticas (`/lab/trymate/stats`) y gráficos: plan aparte.
