# Task 07: Acción `runBotTurn` en el store

> Parte del plan: `../plan.md` — ver "Cómo actúa el bot sobre el store".

## Skill / Capa

Seguir `.devin/skills/rugby-chess-state/SKILL.md` sobre `application/GameState.ts`.

## Objetivo

Una acción que ejecuta **una** acción atómica del bot reutilizando las acciones públicas del
store (y con eso sus validaciones, historial y `resolveStalledTurn`).

## Depende De

- Task 05: `GameMode.VS_COMPUTER`, `getBotPlayer`, `botLayoutId`.
- Task 06: `pickBotLayoutId`, `nextSetupPlacement`, `nextBenchType`, `choosePlayAction`, `Rng`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/GameState.ts` — editar.
- `apps/web/src/lab/trymate/application/BotFlow.test.ts` — crear (usar `createGameStore()` para store aislado, como `OnlineFlow.test.ts`).

## Detalles de Implementación

1. Dentro de `gameStoreInitializer`, antes del objeto: `let botActing = false;`
   (por instancia de store; **no** es estado reactivo).
2. `isLocalPlayerTurn` y `isSetupTurnForLocalPlayer`: devolver `true` si `botActing`.
3. `reset` setea `botLayoutId: null`.
4. Acción nueva (devuelve si hizo algo, para que el hook no entre en loop):

```ts
runBotTurn: (rng: Rng = Math.random): boolean => {
  const s = get();
  const bot = s.getBotPlayer();
  if (!bot || s.currentPlayer !== bot || s.isViewingHistory) return false;
  if (![GamePhase.SETUP, GamePhase.BENCH_SELECTION, GamePhase.PLAYING].includes(s.gamePhase)) return false;

  const layoutId = s.botLayoutId ?? pickBotLayoutId(rng);
  if (!s.botLayoutId) set({ botLayoutId: layoutId });
  const layout = resolveQuickStartLayout(bot, layoutId);
  const before = JSON.stringify(get().toSnapshot());

  botActing = true;
  try {
    const st = get();
    const ps = st.getCurrentPlayerState();
    if (st.gamePhase === GamePhase.SETUP && ps.getPlacedPiecesCount() < GAME_RULES.PIECES_TO_PLACE) {
      const next = nextSetupPlacement(st.board, bot, layout);
      if (next) { st.selectPieceTypeForSetup(next.type); get().placePieceInSetup(next.position); }
    } else if (st.gamePhase === GamePhase.SETUP || st.gamePhase === GamePhase.BENCH_SELECTION) {
      const type = nextBenchType(ps, layout);
      if (type) st.selectPieceTypeForBench(type);
    } else {
      const action = choosePlayAction(st.board, bot, ps, st.movementEngine, rng);
      if (action.kind === "bench") {
        const piece = ps.getBenchPieces().find((p) => p.id === action.benchPieceId);
        if (piece) { st.selectBenchPiece(piece); get().placeBenchPiece(action.to); }
      } else if (action.kind === "move") {
        const piece = st.board.getPieceById(action.pieceId);
        if (piece?.position) { st.selectTile(piece.position); get().movePiece(action.to); }
      } else {
        get().resolveStalledTurn();
      }
    }
  } finally {
    botActing = false;
  }
  return JSON.stringify(get().toSnapshot()) !== before;
},
```

- Agregar la firma a `GameStateStore`: `runBotTurn: (rng?: Rng) => boolean;`
- Usar `get()` después de cada acción: las acciones hacen `set` y el objeto `st` queda viejo.
- Comparar snapshots incluye `currentPlayer`/`gamePhase`, así que un `pass` que cambia
  turno cuenta como acción.

5. Si quick start ya colocó al bot (layout propio), `nextSetupPlacement` no se usa: la fase ya es PLAYING.

## Fuera de Alcance

- No agregar timers ni hooks React (Task 08). No UI (Task 09).

## Verificación

- [ ] Test ALTERNATING: `startVsComputer(ALTERNATING)`, el humano coloca con
      `selectPieceTypeForSetup` + `handleTileClick`, luego `runBotTurn(() => 0.5)`; repetir
      hasta completar → `BENCH_SELECTION`; humano elige 3 de banca, bot 3 → `PLAYING` con 5
      piezas NEGRAS en `y` 7–9 y 3 en banca.
- [ ] Test HIDDEN: humano completa setup; `runBotTurn` en loop hasta `false` → `PLAYING`.
- [ ] Test PLAYING (quick start): tras mover el humano, `runBotTurn()` devuelve `true`,
      el historial suma 1 movimiento de NEGRAS y `currentPlayer === BLANCAS`
      (o sigue NEGRAS si la acción fue de banca).
- [ ] Test: `runBotTurn()` devuelve `false` en PVP, en turno humano y con `isViewingHistory`.
- [ ] Partida simulada: loop humano-aleatorio vs bot con `rng` sembrado (≤ 400 acciones)
      termina en `GAME_OVER` sin excepciones.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: `runBotTurn(rng?) => boolean` para el hook de Task 08.
