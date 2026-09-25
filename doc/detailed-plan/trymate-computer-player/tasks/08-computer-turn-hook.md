# Task 08: Hook `useComputerTurn`

> Parte del plan: `../plan.md` — ver "Cómo actúa el bot sobre el store" (último punto).

## Skill / Capa

Hook React del módulo (application). Reglas de `.devin/rules/rules.md` (prefijo `use`, named export).

## Objetivo

Disparar `runBotTurn` con demora cuando es turno del bot, y re-agendar mientras siga siéndolo.

## Depende De

- Task 07: `runBotTurn(rng?) => boolean`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/useComputerTurn.ts` — crear.
- `apps/web/src/lab/trymate/application/useComputerTurn.test.ts` — crear (vitest fake timers + `renderHook` de `@testing-library/react`, ya usado en el repo).

## Detalles de Implementación

```ts
export const BOT_DELAY_MS = { setup: 250, playing: 700 } as const;

export function useComputerTurn(): void {
  const gameMode = useGameStore((s) => s.gameMode);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const isViewingHistory = useGameStore((s) => s.isViewingHistory);
  const moveCount = useGameStore((s) => s.moveHistory.getTotalMoves());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const s = useGameStore.getState();
    const bot = s.getBotPlayer();
    if (gameMode !== GameMode.VS_COMPUTER || !bot || currentPlayer !== bot || isViewingHistory)
      return;
    if (gamePhase === GamePhase.GAME_OVER) return;
    const delay = gamePhase === GamePhase.PLAYING ? BOT_DELAY_MS.playing : BOT_DELAY_MS.setup;
    const id = window.setTimeout(() => {
      const acted = useGameStore.getState().runBotTurn();
      if (acted) setTick((t) => t + 1); // re-evaluar: banca/setup pueden dejar el turno en el bot
    }, delay);
    return () => window.clearTimeout(id);
  }, [gameMode, currentPlayer, gamePhase, isViewingHistory, moveCount, tick]);
}
```

- `tick` fuerza re-agendado cuando el bot actúa sin cambiar `currentPlayer` (banca, setup HIDDEN).
- Si `runBotTurn` devuelve `false` no se re-agenda (evita loop infinito ante un bug);
  `console.warn` en modo dev es aceptable.
- El cleanup cancela el timer al salir al menú o al cambiar de modo.

## Fuera de Alcance

- No montar el hook en la página (Task 09).

## Verificación

- [ ] Test: en VS_COMPUTER con turno del bot, tras `vi.advanceTimersByTime(700)` el bot movió.
- [ ] Test: en PVP no se llama `runBotTurn` (spy).
- [ ] Test: con `isViewingHistory: true` no actúa; al volver al presente sí.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/useComputerTurn.test.ts`
- [ ] `pnpm typecheck`

## Handoff

- Produce: `useComputerTurn()` para montar en `TryMatePage` (Task 09).
