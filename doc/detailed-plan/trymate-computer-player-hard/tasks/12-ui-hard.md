# Task 12: UI — opción Hard, personalidad e indicador de pensamiento

> Parte del plan: `../plan.md` — ver "Pantallas / Componentes".

## Skill / Capa

`.devin/skills/add-ui-component/SKILL.md` (organismos del módulo) + `responsive-layout`.

## Objetivo

Elegir Hard en el menú y ver claramente cuándo la computadora está pensando o cargando.

## Depende De

- Task 11 (`"hard"`, `botLoading`), Task 08 (`botThinking`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/components/DifficultySelector.tsx` — agregar opción.
- `apps/web/src/lab/trymate/components/PersonalitySelector.tsx` — crear (+ test).
- `apps/web/src/lab/trymate/TryMatePage.tsx` — editar.
- `apps/web/src/lab/trymate/components/GameStatusBar.tsx` — estados.
- `apps/web/src/lab/trymate/lib/rulesContent.ts` — texto.
- Tests de ambos componentes.

## Detalles de Implementación

1. Opción `hard` — "Hard" — hint: "Calculates several moves ahead, wins races and trades. Takes about a second to think."
   1b. Nuevo organismo `components/PersonalitySelector.tsx` (mismo patrón radio group que
   `SetupModeSelector`), visible en el menú **solo si** la dificultad elegida es `hard`
   (renderizado condicional, sin ocupar espacio si no). Opciones y hints:
   - `balanced` — "Balanced" — "Adapts: attacks when ahead, defends when threatened."
   - `offensive` — "Offensive" — "Pushes runners early and takes risks to score first."
   - `defensive` — "Defensive" — "Builds a wall, blocks your runners and waits for mistakes."
     `TryMatePage`: `menuPersonality` en `useState` (default = `botPersonality` del store) y pasarlo a
     `startVsComputer(menuSetupMode, menuDifficulty, menuPersonality)`.
2. `GameStatusBar` en VS_COMPUTER, turno del bot: `botLoading` → "Loading computer…";
   `botThinking` → "Computer is thinking…"; si no, el texto actual. `aria-live="polite"` ya existe.
   Badge "Computer · Hard · Offensive" (agregar la personalidad solo en Hard).
3. Reglas (EN/ES): extender la línea de dificultades:
   EN "Hard calculates several moves ahead and punishes loose pieces." /
   ES "Difícil calcula varias jugadas adelante y castiga las piezas sueltas."
4. Solo tokens del theme; sin hex.

## Fuera de Alcance

- Barras de progreso o mostrar la PV (posible mejora futura).

## Verificación

- [ ] El selector de personalidad aparece solo con Hard; su valor llega a `startVsComputer`.
- [ ] Selector con 3 opciones; `aria-checked` correcto; clic en Hard → `onChange("hard")`.
- [ ] Status bar muestra "Loading computer…" y "Computer is thinking…" según el store.
- [ ] Manual ≤ 680 px: el selector de 3 opciones no desborda.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/components` + `pnpm typecheck`

## Handoff

- Produce: Hard accesible desde la UI.
