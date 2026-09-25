# Task 01: Corregir filas en el texto de reglas

> Parte del plan: `../plan.md` — ver "P3 — Texto de reglas con filas incorrectas".

## Skill / Capa

Texto de UI del módulo (`lib/`). Reglas de `.devin/rules/rules.md`.

## Objetivo

Que las reglas visibles (EN y ES) usen la misma numeración de filas que muestra el tablero
(`y + 1`, ver `lib/gameDisplay.ts`).

## Depende De

- Nada.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/lib/rulesContent.ts` — editar strings `board` (en/es).
- `apps/web/src/lab/trymate/components/RulesPanel.test.tsx` — ajustar si algún assert usa el texto viejo.

## Detalles de Implementación

Reemplazar el campo `board`:

- EN: `"The field is 5 columns × 11 rows. You deploy on rows 2–4 (White) or 8–10 (Black) and score by reaching the opponent's last row (row 11 for White, row 1 for Black). Rows 1 and 11 are never deployment rows."`
- ES: `"El campo tiene 5 columnas × 11 filas. Desplegás en las filas 2–4 (Blancas) u 8–10 (Negras) y anotás al llegar a la última fila rival (fila 11 para Blancas, fila 1 para Negras). Las filas 1 y 11 nunca son de despliegue."`

Aprovechar para corregir el `special` de STRIKER en EN (`"Can defense and attack with effectivity"`)
por la traducción del ES: `"Its 2-step charge makes it the fastest piece off the line."`

## Fuera de Alcance

- No tocar `GAME_RULES` ni ninguna lógica.

## Verificación

- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/components/RulesPanel.test.tsx`
- [ ] `pnpm typecheck`

## Handoff

- Produce: texto de reglas consistente con el tablero.
