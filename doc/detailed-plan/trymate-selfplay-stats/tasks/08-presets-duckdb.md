# Task 08: Presets de experimentos y consultas DuckDB

> Parte del plan: `../plan.md` — ver "Experimentos" y "Objetivo" (laboratorio de reglas).

## Skill / Capa

Datos (`selfplay/experiments/*.json`) + documentación/SQL (`selfplay/duckdb/`).

## Objetivo

Dejar listos los experimentos más útiles y recetas para explorar los datos a mano sin programar.

## Depende De

- Task 04 (formato de experimento), Task 06 (campos del registro/summary).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/experiments/*.json` — crear presets.
- `apps/web/src/lab/trymate/selfplay/experiments/experiments.test.ts` — crear (todos parsean).
- `apps/web/src/lab/trymate/selfplay/duckdb/README.md` — crear.
- `apps/web/src/lab/trymate/selfplay/duckdb/views.sql`, `queries.sql` — crear.

## Detalles de Implementación

Presets (todos con `budget` por nodos, `swapColors: true`, `opening: { randomPlies: 4, epsilon: 0.15 }` salvo indicación):

| Archivo                     | Bots                                          | Reglas                                        | Partidas               | Para qué                                        |
| --------------------------- | --------------------------------------------- | --------------------------------------------- | ---------------------- | ----------------------------------------------- |
| `smoke.json`                | easy vs easy                                  | current                                       | 40                     | Verificar que todo anda (1–2 min)               |
| `balance-medium.json`       | medium vs medium                              | current                                       | 2 000                  | Balance de reglas con el bot disponible hoy     |
| `balance-hard.json`         | hard balanced vs hard balanced (20 000 nodos) | current                                       | 5 000                  | Balance "serio"                                 |
| `personalities-matrix.json` | hard × {balanced, offensive, defensive}²      | current                                       | 4 500 (500 por celda)  | Matriz de estilos                               |
| `rules-board-7x13.json`     | medium vs medium                              | current + `{ board: 7×13 }`                   | 2 × 2 000              | ¿Tablero más grande cambia el balance/duración? |
| `rules-deploy-depth-2.json` | medium vs medium                              | current + `{ rules: { PLACEMENT_DEPTH: 2 } }` | 2 × 2 000              | Despliegue más apretado                         |
| `rules-points-4.json`       | medium vs medium                              | current + `{ rules: { POINTS_TO_WIN: 4 } }`   | 2 × 2 000              | Partidas más largas                             |
| `setup-modes.json`          | medium vs medium                              | current                                       | 3 000 (1 000 por modo) | ¿HIDDEN/RANDOM cambian el balance?              |

Los presets con `hard` fallan con mensaje claro si Hard aún no está registrado (Task 04).

DuckDB (opcional, `brew install duckdb`; gratis):

- `views.sql`: vistas sobre `read_json_auto('<batch>/games-*.jsonl.gz')`:
  `games` (una fila por partida: variant, matchup, setupMode, winner, reason, plies),
  `plies` (`UNNEST(plies)` con `game_id`, `n`, `player`, `kind`, `type`, `from`, `to`, `capture`, `scored`),
  `setups` (una fila por pieza desplegada).
  Parametrizar el path con `SET VARIABLE batch = '...'` (documentar la versión mínima de DuckDB que lo soporta; si no, reemplazo manual).
- `queries.sql`: 8 consultas comentadas: ventaja por color; plies por razón de fin; capturas por
  tipo; columnas de anotación; win rate por pieza en fila delantera; bajadas de banca vs victoria;
  partidas más largas para inspeccionar; exportar a CSV (`COPY … TO 'x.csv'`).
- `README.md`: cómo instalar DuckDB, abrir un batch, correr las vistas y consultas, y cómo
  abrir los CSV en Numbers/Excel.

## Fuera de Alcance

- Notebooks de Python (se pueden agregar después leyendo los mismos JSONL).

## Verificación

- [ ] `experiments.test.ts`: todos los presets pasan `parseExperiment` (los de hard con un registro falso de "hard").
- [ ] Manual: `duckdb` + `views.sql` + 2 consultas sobre el batch smoke devuelven resultados coherentes con `report.md`.

## Handoff

- Produce: experimentos listos para correr y exploración ad-hoc.
