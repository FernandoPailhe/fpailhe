# Task 09: UI del modo vs computadora

> Parte del plan: `../plan.md` — ver "Pantallas / Componentes".

## Skill / Capa

`.devin/skills/add-ui-component/SKILL.md` (solo organismos del módulo; no crear nada en
`packages/ui`) y `.devin/skills/responsive-layout/SKILL.md` para verificar ≤ 680px.

## Objetivo

Exponer el modo en el menú y adaptar textos de estado y resultado.

## Depende De

- Task 05: `startVsComputer`, `getBotPlayer`, `playAgain`.
- Task 08: `useComputerTurn`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/TryMatePage.tsx` — editar.
- `apps/web/src/lab/trymate/components/GameStatusBar.tsx` — editar.
- `apps/web/src/lab/trymate/components/GameOverPanel.tsx` — editar.
- `apps/web/src/lab/trymate/TryMatePage.test.tsx` — agregar test del botón.
- `apps/web/src/lab/trymate/lib/rulesContent.ts` — agregar una línea sobre el modo (campo `online` o nuevo `computer`).

## Detalles de Implementación

1. `TryMatePage`:
   - Llamar `useComputerTurn()` al inicio del componente (es no-op fuera de VS_COMPUTER).
   - Nueva acción `goVsComputer = () => { useGameStore.getState().startVsComputer(menuSetupMode); setSetupPassAcknowledged(true); setScreen("local"); }`.
   - Botón debajo de "Play local 1v1", mismo componente `Button` de `@ferpa/ui`:
     `Play vs computer (Easy)`.
2. `GameStatusBar`:
   - `const vsComputer = gameMode === GameMode.VS_COMPUTER;`
   - `turnLabel`: online → igual que hoy; vsComputer → `isLocalPlayerTurn() ? "Your turn" : "Computer is thinking…"`; PVP → igual que hoy.
   - Badge `You are White` también en vsComputer (reusar el de online con `(online || vsComputer) && localPlayer`).
   - Botón quick start: condición `gameMode !== GameMode.ONLINE` (ya equivale a `!online`).
3. `GameOverPanel`:
   - En VS_COMPUTER: `result = humanScore > botScore ? "You win" : botScore > humanScore ? "Computer wins" : "Draw"` (humano = BLANCAS = `player1State`).
   - "Play again" → `playAgain()` (si Task 05 no lo hizo ya).
4. Reglas: agregar a EN `"Vs computer: you play White against an easy AI that makes quick, imperfect decisions."` y a ES `"Vs computadora: jugás con Blancas contra una IA fácil que decide rápido y con errores."` (mostrar en `RulesPanel` junto al párrafo `online`).
5. Solo clases de tokens existentes (`text-ink`, `text-ink-dim`, `bg-gold-soft`, etc.). Sin hex.

## Fuera de Alcance

- No elegir color del humano ni dificultad (solo "Easy").
- No crear componentes en `packages/ui`.

## Verificación

- [ ] Test: el menú muestra "Play vs computer (Easy)"; al clickearlo aparece el tablero y
      `gameMode === VS_COMPUTER`.
- [ ] Manual (`pnpm dev`, `/lab/trymate`): jugar una partida completa en ALTERNATING y otra en
      HIDDEN; el bot responde en ~0.7 s; el tablero queda inerte en su turno.
- [ ] Manual: ancho ≤ 680px — botones del menú y status bar sin overflow.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: feature completa lista para verificación final.
