# Task 14: Verificación final

> Parte del plan: `../plan.md` — ver "Criterios de Aceptación Globales".

## Skill / Capa

Checklist de `.devin/rules/rules.md` (sección 10) + `.devin/skills/rugby-chess-code-review/SKILL.md`.

## Objetivo

Confirmar que Medium funciona en la app, que el bot es agnóstico de reglas y que Easy / PVP /
Online no cambiaron.

## Depende De

- Tasks 01–13.

## Archivos a Crear/Editar

- `.devin/skills/rugby-chess-state/SKILL.md` — documentar `ComputerPlayer`, `botDifficulty`,
  `botController`, tablero filtrado en HIDDEN y motor configurable.
- `.devin/skills/rugby-chess-domain/SKILL.md` — documentar `PLACEMENT_DEPTH`, filas derivadas,
  `RulesView` y la receta **"Cambiar reglas del juego"**:
  1. Editar `GAME_CONFIG` / `GAME_RULES` / `PIECE_MOVEMENT_CONFIG`.
  2. Actualizar `quickstart-layouts.json` si el loader lo rechaza.
  3. Correr `pnpm test` (contrato del motor + variantes) y la arena.
  4. Si `tactics.current-rules` quedó salteado: re-anclar escenarios y `EXPECTED_FINGERPRINT`.
  5. Si se agregó una mecánica nueva: evaluar si merece un término en `medium/evaluation.ts`.

## Detalles de Implementación

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
TRYMATE_ARENA=1 pnpm exec vitest run apps/web/src/lab/trymate/application/ai
pnpm build
```

Chequeos estáticos (deben devolver vacío):

```bash
grep -rnE "from \"(react|zustand)\"|useGameStore" apps/web/src/lab/trymate/application/ai --include=*.ts | grep -v "\.test\.ts"
grep -rnE "PieceType\.|GAME_RULES|GAME_CONFIG|PIECE_MOVEMENT_CONFIG|QUICK_START" apps/web/src/lab/trymate/application/ai --include=*.ts | grep -v "\.test\.ts" | grep -v "/testing/"
```

Prueba de humo de agnosticismo (local, **no commitear**): cambiar `BOARD_HEIGHT` a 13 y
`BOARD_WIDTH` a 7, `pnpm dev`, jugar vs Medium unos turnos (tablero, despliegue y bot se
adaptan); revertir.

Pruebas manuales con reglas actuales (`/lab/trymate`):
1. ALTERNATING: STRIKER propio en columna 2 → el bot no enfrenta con FORT en la columna 2.
2. Lanzar un PIONEER por un carril → el bot lo tapona o controla su avance.
3. Corredor a 3 de anotar → el bot defiende.
4. HIDDEN y quick start: partidas completas sin cuelgues.
5. Easy sigue sintiéndose fácil; PVP local y Online sin cambios.

## Fuera de Alcance

- Nuevas features.

## Verificación

- [ ] Comandos y greps OK; prueba de humo OK y revertida.
- [ ] 5 pruebas manuales OK.
- [ ] Skills actualizados.

## Handoff

- Produce: feature lista para PR y receta para futuros cambios de reglas.
