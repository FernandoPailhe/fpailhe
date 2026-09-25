# Task 07: Reporte legible y comparación de batches

> Parte del plan: `../plan.md` — ver "Estadísticas" (reglas estadísticas: n, ⚠, Wilson).

## Skill / Capa

`selfplay/core` (render de texto puro) + `selfplay/node` (CLI).

## Objetivo

Convertir `summary.json` en un `report.md` que se entienda sin abrir código, y comparar dos
batches (ej. reglas actuales vs 7×13, u ofensivo vs defensivo) marcando qué diferencias son reales.

## Depende De

- Task 06 (`Summary`, `wilson`, `overlaps`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/core/renderReport.ts` — crear (+ test con snapshot).
- `apps/web/src/lab/trymate/selfplay/core/compare.ts` — crear (+ test).
- `apps/web/src/lab/trymate/selfplay/node/cli.ts` — `report` escribe también `report.md`; subcomando `compare`.

## Detalles de Implementación

1. `renderReport(summary, manifest): string` — secciones en este orden (español, conciso):
   1. **Resumen**: partidas, fallas, duración, partidas/hora, variantes, matchups, advertencias.
   2. **Balance**: tabla por variante: % Blancas / % Negras (con IC), empates, razones de fin,
      plies p10/p50/p90; conclusión automática: "Ventaja de Blancas significativa (IC no incluye 50 %)" o "Sin ventaja significativa".
   3. **Piezas**: tabla por tipo (desplegadas, supervivencia %, capturas hechas/sufridas, puntos, plies hasta anotar) + matriz captor→víctima.
   4. **Composiciones y formaciones**: top 10 y bottom 10 por win rate (n ≥ 30), con IC.
   5. **Tablero**: heatmaps como grillas de texto (valores normalizados 0–9, fila de anotación
      arriba) para ocupación y capturas; columnas de anotación en barra (`█` proporcional).
   6. **Banca** y **tempo** (quién anota primero gana %, remontadas).
   7. **Personalidades** (si hay): matriz de win rates y métricas de estilo promedio.
   8. **Calibración** del bot (si hay `eval`).
   9. **Datos**: rutas de shards, schema, fingerprint(s), git sha, config usada (JSON colapsado en `json`).
      Toda celda con `n < 200` lleva ⚠. Números con 1 decimal; porcentajes con `%`.
2. `compareSummaries(a, b, opts: { by?: "variant" | "matchup" | "all" }): CompareResult` +
   `renderCompare(result): string`: para cada métrica escalar común (win rate por color, plies,
   % bloqueos, supervivencia por tipo, puntos por tipo, first-scorer-wins) mostrar A, B, Δ y
   "✔ significativa" si los IC de Wilson no se solapan (proporciones) o si
   `|Δmean| > 2 × sqrt(sA²/nA + sB²/nB)` (medias). Advertir si los fingerprints de reglas o las
   versiones de bots difieren (esperable en experimentos de reglas; se muestra igual).
3. CLI: `report <batchDir…>` → `summary.json` + `report.md`; `compare <A> <B> [--by variant] [--out file.md]`
   (default imprime a stdout y guarda `compare-<A>-vs-<B>.md` en el directorio padre).

## Fuera de Alcance

- Gráficos en imagen/HTML (plan futuro de página de estadísticas).

## Verificación

- [ ] Snapshot de `renderReport` con un `Summary` sintético fijo.
- [ ] `compare` detecta como significativa una diferencia 60 % vs 40 % con n = 1 000 y no una 52 % vs 50 % con n = 200.
- [ ] Sobre el batch del smoke test: `report.md` legible, con ⚠ por n chico.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/selfplay` + `pnpm typecheck`

## Handoff

- Produce: `report.md` y `compare` para el ciclo de diseño de reglas.
