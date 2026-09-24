# Task 12: Selector de dificultad en la UI

> Parte del plan: `../plan.md` — ver "Pantallas / Componentes".

## Skill / Capa

`.devin/skills/add-ui-component/SKILL.md` (organismo del módulo, no `packages/ui`) +
`.devin/skills/responsive-layout/SKILL.md`.

## Objetivo

Elegir Easy o Medium antes de jugar contra la computadora y ver la dificultad durante la partida.

## Depende De

- Task 01 (`BotDifficulty`, `startVsComputer(mode, difficulty)`). Puede hacerse antes de
  Task 11: si "medium" no está registrado, `createComputerPlayer` cae en Easy.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/components/DifficultySelector.tsx` — crear.
- `apps/web/src/lab/trymate/components/DifficultySelector.test.tsx` — crear.
- `apps/web/src/lab/trymate/TryMatePage.tsx` — editar.
- `apps/web/src/lab/trymate/components/GameStatusBar.tsx` — editar.
- `apps/web/src/lab/trymate/lib/rulesContent.ts` — editar.

## Detalles de Implementación

1. `DifficultySelector`: copiar la estructura de `SetupModeSelector.tsx` (radio group con
   `Button variant="tab"`, `role="radio"`, `aria-checked`), props
   `{ value: BotDifficulty; onChange: (d: BotDifficulty) => void }`. Opciones:
   - `easy` — "Easy" — hint: "Quick, imperfect decisions. Good to learn the rules."
   - `medium` — "Medium" — hint: "Looks one reply ahead, blocks runners and advances in formation."
2. `TryMatePage`:
   - `const [menuDifficulty, setMenuDifficulty] = useState<BotDifficulty>(() => useGameStore.getState().botDifficulty);`
   - Renombrar el botón a `Play vs computer` y llamar `startVsComputer(menuSetupMode, menuDifficulty)`.
   - Orden en el menú: Play online · SetupModeSelector · Play local 1v1 · DifficultySelector · Play vs computer.
3. `GameStatusBar`: en VS_COMPUTER mostrar badge `Computer · Easy` / `Computer · Medium`
   con las mismas clases de token que el badge "You are White".
4. Reglas: reemplazar la línea "Vs computer" del plan Easy por
   EN: `"Vs computer: you play White. Easy makes quick, imperfect decisions; Medium looks one reply ahead, blocks your runners and advances in formation."`
   ES: `"Vs computadora: jugás con Blancas. Fácil decide rápido y con errores; Medio mira tu respuesta, frena tus corredores y avanza en bloque."`

## Fuera de Alcance

- No persistir la dificultad fuera del store (sin localStorage). No rutas nuevas.

## Verificación

- [ ] Test del selector: clic en Medium llama `onChange("medium")`; `aria-checked` correcto.
- [ ] Test de página: elegir Medium + "Play vs computer" → `botDifficulty === "medium"`.
- [ ] Manual ≤ 680px: menú sin overflow horizontal.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: UI completa para elegir dificultad.
