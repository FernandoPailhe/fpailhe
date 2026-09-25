# Task 09: Verificación final, rendimiento y documentación

> Parte del plan: `../plan.md` — ver "Criterios de Aceptación Globales".

## Skill / Capa

Checklist de `.devin/rules/rules.md` (sección 10).

## Objetivo

Confirmar el flujo completo en la Mac mini, medir rendimiento real y documentar el uso.

## Depende De

- Tasks 01–08.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/README.md` — crear.
- `.devin/rules/project-map.md` — agregar `selfplay/` y los comandos `trymate:*`.
- `.devin/skills/rugby-chess-domain/SKILL.md` — en la receta "Cambiar reglas", agregar:
  "antes de implementar un cambio de reglas en la UI, probarlo con un preset `rules-*` y `trymate:compare`".

## Detalles de Implementación

1. Comandos:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm trymate:selfplay --config apps/web/src/lab/trymate/selfplay/experiments/smoke.json --report
pnpm trymate:validate <batchDir>          # valida todo + replayGame en 5 % de las partidas
pnpm trymate:selfplay --config apps/web/src/lab/trymate/selfplay/experiments/balance-medium.json --games 300 --report
pnpm trymate:compare <batchSmoke> <batchBalance>
```

2. `validate <batchDir>`: `validateGameRecord` en todas las líneas + `replayGame` en una muestra
   (5 %, mín. 20) → resumen `ok/fallas`. (Implementar en `cli.ts` si no existe.)
3. Rendimiento: correr cada matchup disponible 5 minutos y anotar partidas/hora en el README
   (tabla: matchup · workers · nodos · g/h · tamaño medio por partida gz).
4. README del módulo: qué es, requisitos (Node 20, `pnpm`), comandos, formato de datos
   (link al esquema), dónde quedan los datos, cómo reanudar, cómo leer el reporte, cómo crear
   un experimento de reglas, DuckDB opcional, y "próximos pasos: opción 2 (red de evaluación)".
5. Bundle web: comparar `apps/web/dist/assets` antes/después (sin cambios atribuibles).

## Fuera de Alcance

- Correr los presets grandes (se hace después, a demanda).

## Verificación

- [ ] Todos los comandos OK; `validate` sin fallas.
- [ ] README con tabla de rendimiento real de la Mac mini.
- [ ] project-map y skill actualizados.

## Handoff

- Produce: laboratorio de estadísticas listo para usar.
