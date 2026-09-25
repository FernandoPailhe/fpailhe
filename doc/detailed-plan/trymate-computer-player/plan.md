# Plan: TryMate — Fixes de turno + Jugador Computadora (Fácil)

## Objetivo

Permitir jugar TryMate contra un jugador "computer" de nivel fácil desde el menú del módulo
(`/lab/trymate`). Antes de agregar el bot se corrigen tres problemas de reglas/flujo que hoy
pueden colgar la partida o bloquear movimientos, porque el bot los dispararía de forma
sistemática.

## Fuente de Requerimientos

- Pedido del usuario (conversación) + revisión del código actual:
  - `apps/web/src/lab/trymate/lib/rulesContent.ts` (reglas visibles)
  - `apps/web/src/lab/trymate/domain/constants/GameRules.ts`, `PieceConstants.ts`
  - `apps/web/src/lab/trymate/application/GameState.ts` (store Zustand)
  - `apps/web/src/lab/trymate/application/rules/MovementRuleEngine.ts`
- Skills de referencia: `.devin/skills/rugby-chess-domain`, `rugby-chess-state`,
  `rugby-chess-code-review`. **Nota:** esos skills mencionan `lab/rugby-chess/...` y nombres
  viejos de piezas (BULWARK/VANGUARD/APEX); el módulo real es `apps/web/src/lab/trymate/` con
  FORT/STRIKER/PIONEER. Aplicar sus convenciones sobre las rutas actuales.
- **Base del plan:** working tree del 2026-09-23, que tiene cambios sin commitear en
  `GameState.ts`, `MovementRuleEngine.ts`, `GameStatusBar.tsx`, tests y `domain/config/`.
  Commitear ese trabajo antes de ejecutar este plan.

## Resumen de Reglas (lo que el bot debe respetar)

| Concepto                    | Valor en código                                                           |
| --------------------------- | ------------------------------------------------------------------------- |
| Tablero                     | 5 × 11, `x` 0..4, `y` 0..10. UI muestra filas `y + 1` (1..11)             |
| Despliegue BLANCAS / NEGRAS | `y` ∈ {1,2,3} / {7,8,9} → UI filas 2–4 / 8–10                             |
| Anota BLANCAS / NEGRAS      | `y = 10` / `y = 0` (la pieza sale del tablero, +1 punto)                  |
| Victoria                    | 3 puntos, o ningún jugador con acciones legales                           |
| Setup                       | 5 piezas en tablero, máx 2 por fila; + 3 de banca; 2..4 por tipo en total |
| Banca en juego              | Acción libre (no consume turno) si el jugador tiene < 5 piezas en tablero |
| Dirección                   | `GamePiece.getDirectionMultiplier()`: +1 BLANCAS, −1 NEGRAS               |

Piezas: FORT (avanza 1, captura diagonal adelante, bloquea sus costados a rivales),
STRIKER (1 adelante/diagonal o 2 recto con camino libre, captura solo de frente),
PIONEER (L de 1–3 adelante + 1 lateral opcional, no captura, puede sortear Fort a ≥ 2 filas).

## Problemas a Corregir (primero)

### P1 — Turno trabado sin movimientos legales

`checkGameOver()` solo se invoca desde `checkScoring()`. Si el jugador que recibe el turno no
tiene movimientos ni puede bajar banca, la partida queda congelada (la UI solo muestra
"No legal moves"). Además `canPlaceBenchPiece()` depende de `isLocalPlayerTurn()`, así que no
sirve para evaluar al rival en ONLINE.

**Decisión:** pase de turno automático.

- Nueva función pura `hasAnyLegalAction(board, player, playerState, engine)`.
- Nueva acción `resolveStalledTurn()` que se ejecuta después de cada `movePiece`, de cada
  `placeBenchPiece` y al entrar a `PLAYING`:
  - si el jugador actual tiene alguna acción → no hace nada;
  - si no tiene y el rival sí → cambia `currentPlayer` y setea `lastPassedPlayer`;
  - si ninguno tiene → `gamePhase = GAME_OVER`.
- `lastPassedPlayer: Player | null` se agrega al store y (opcional) al snapshot online para
  que ambos clientes vean el aviso. Se limpia en el siguiente movimiento.

### P2 — La prioridad de banca bloquea movimientos a casillas vacías

En `handleTileClick`, si `canPlaceBenchPiece()` y la casilla está vacía, se llama a
`placeBenchPiece` y se hace `return`, aunque haya una pieza seleccionada y la casilla sea un
movimiento válido. Fuera de las filas de despliegue `placeBenchPiece` no hace nada → el
movimiento nunca ocurre. Dentro de las filas, baja una pieza de banca en vez de mover.

**Decisión:** la prioridad de banca aplica solo si (a) hay `selectedBenchPiece`, o (b) no hay
`selectedPiece` **y** la casilla está en `getBenchPlacementSquares(...)`. En cualquier otro
caso se sigue al paso "movimiento confirmado".

### P3 — Texto de reglas con filas incorrectas

`rulesContent.ts` dice "rows 1–3 / 9–11"; con la numeración de la UI (`y + 1`) son
**2–4 / 8–10**, y la anotación es en la fila 11 (Blancas) / 1 (Negras).

## Entidades / Tipos Nuevos

Todo vive dentro del módulo `apps/web/src/lab/trymate/` (no en `@ferpa/data-model`: el módulo
lab es independiente, igual que el resto de su dominio).

### `GameMode` (editar enum en `domain/constants/GameRules.ts`)

```ts
export enum GameMode {
  PVP = "PVP",
  ONLINE = "ONLINE",
  VS_COMPUTER = "VS_COMPUTER",
}
```

### Campos nuevos del store (`GameStateStore`)

| Campo / Acción       | Tipo                                 | Notas                                                 |
| -------------------- | ------------------------------------ | ----------------------------------------------------- |
| `lastPassedPlayer`   | `Player \| null`                     | P1. Aviso de pase automático                          |
| `botLayoutId`        | `string \| null`                     | Layout de quick start que el bot usa para su setup    |
| `resolveStalledTurn` | `() => void`                         | P1                                                    |
| `startVsComputer`    | `(setupMode: SetupTurnMode) => void` | Humano = BLANCAS, bot = NEGRAS                        |
| `playAgain`          | `() => void`                         | Reinicia conservando el modo (PVP / VS_COMPUTER)      |
| `getBotPlayer`       | `() => Player \| null`               | Opuesto de `localPlayer` en VS_COMPUTER, si no `null` |
| `runBotTurn`         | `() => void`                         | Ejecuta **una** acción atómica del bot                |

En VS_COMPUTER se reutiliza `localPlayer` = jugador humano (BLANCAS). `roomId` queda `null`,
así `roomSync` nunca escribe.

### Tipos del bot (`application/ai/EasyBot.ts`)

```ts
export type BotPlayAction =
  | { kind: "bench"; benchPieceId: string; to: Position }
  | { kind: "move"; pieceId: string; to: Position }
  | { kind: "pass" };

export interface EasyBotConfig {
  randomMoveChance: number; // 0.3
  topK: number; // 3
  weights: {
    score: number;
    capture: number;
    advancePerRow: number;
    threatened: number;
    noise: number;
  };
}
```

## Lógica Derivada (funciones puras)

Archivo `application/rules/turnRules.ts` (application porque depende de `MovementRuleEngine`):

- `getPlacementRows(player): readonly number[]`
- `getBenchPlacementSquares(board, player): Position[]` — casillas vacías en filas de despliegue
  con < 2 piezas propias en la fila. Reemplaza el código triplicado en `GameState.ts`
  (`selectPieceTypeForSetup`, `selectBenchPiece`, validaciones de `placePieceInSetup` /
  `placeBenchPiece`).
- `canPlaceFromBench(board, player, playerState): boolean` — sin gating de turno local.
- `hasAnyLegalMove(board, player, engine): boolean`
- `hasAnyLegalAction(board, player, playerState, engine): boolean`

Archivo `application/ai/EasyBot.ts` (puro, sin Zustand ni React, `rng` inyectable):

- `pickBotLayoutId(rng)` → id aleatorio de `QUICK_START_LAYOUTS`.
- `nextSetupPlacement(board, bot, layout)` → siguiente `{ type, position }` del layout aún no
  colocado (layout ya espejado con `resolveQuickStartLayout(bot, id)`).
- `nextBenchType(playerState, layout)` → siguiente tipo de `layout.benchPieces` todavía no
  elegido (comparar como multiset con `getBenchPieces()`).
- `choosePlayAction(board, bot, playerState, engine, rng, config?)`:
  1. Si `canPlaceFromBench` → `bench` con la primera pieza de banca en una casilla aleatoria
     de `getBenchPlacementSquares`, preferencia por la fila más adelantada.
  2. Generar candidatos `getValidMoves` de cada pieza propia.
  3. Puntaje: +100 si `to.y` es la fila de anotación; +30 si hay pieza rival en `to`;
     +3 por fila avanzada; −15 si `to` está en `getThreatenedSquares(board, bot)`; + ruido
     `rng() * 5`.
  4. Con prob. `randomMoveChance` elegir cualquier candidato; si no, uno al azar entre los
     `topK` mejores. Sin candidatos → `pass`.
- `getThreatenedSquares(board, bot)`: aproximación barata — para cada FORT rival sus 2
  diagonales hacia adelante; para cada STRIKER rival la casilla de enfrente (dirección del
  rival). No simula bloqueos.

**Por qué 1-ply con azar:** ~35 jugadas por turno como máximo, cálculo instantáneo, fácil de
testear con `rng` determinista, y el azar lo mantiene ganable. Niveles superiores (minimax
con alfa-beta sobre tablero clonado con `boardFromPieceSnapshots`) quedan fuera de alcance.

## Cómo actúa el bot sobre el store

- `runBotTurn()` activa un flag interno `botActing` (variable en el closure del initializer,
  **no** estado reactivo) dentro de `try/finally`. `isLocalPlayerTurn()` devuelve `true`
  mientras `botActing` sea `true`, así el bot reutiliza las acciones públicas existentes con
  todas sus validaciones e historial:
  - SETUP: `selectPieceTypeForSetup(type)` + `placePieceInSetup(pos)`; en HIDDEN tras 5
    piezas, `selectPieceTypeForBench(type)`.
  - BENCH_SELECTION: `selectPieceTypeForBench(type)`.
  - PLAYING: `selectBenchPiece` + `placeBenchPiece`, o `selectTile(from)` + `movePiece(to)`.
- El bot **nunca** usa `handleTileClick`.
- Guardas de `runBotTurn`: `gameMode === VS_COMPUTER`, `currentPlayer === getBotPlayer()`,
  `!isViewingHistory` (el historial reemplaza `board` por un snapshot), fase ∈
  {SETUP, BENCH_SELECTION, PLAYING}.
- Un hook `useComputerTurn()` agenda `runBotTurn` con `setTimeout` (700 ms en PLAYING,
  250 ms en setup) mientras sea turno del bot; se re-agenda porque la banca no consume turno.

## Pantallas / Componentes

| Componente                                                          | Cambio                                                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `TryMatePage.tsx`                                                   | Botón "Play vs computer (Easy)"; monta `useComputerTurn()`                                    |
| `GameStatusBar.tsx`                                                 | Labels "Your turn" / "Computer is thinking…"; aviso de pase; quick start visible salvo ONLINE |
| `GameOverPanel.tsx`                                                 | "You win" / "Computer wins" en VS_COMPUTER; "Play again" → `playAgain()`                      |
| `TryMateBoard.tsx`, `PiecePickerDialog.tsx`, `BenchPieceDialog.tsx` | Gating de turno: `gameMode !== PVP` en vez de `=== ONLINE`                                    |

No hay rutas nuevas: el modo es estado de partida dentro de `/lab/trymate`, igual que PVP y
online (mismo criterio que el menú actual).

## Secuencia de Implementación

| #   | Task file                            | Capa / Skill                            | Depende de |
| --- | ------------------------------------ | --------------------------------------- | ---------- |
| 1   | tasks/01-rules-text-rows.md          | lib (texto)                             | —          |
| 2   | tasks/02-turn-rules-helpers.md       | application/rules · `rugby-chess-state` | —          |
| 3   | tasks/03-fix-stalled-turn.md         | store · `rugby-chess-state`             | 2          |
| 4   | tasks/04-fix-bench-click-priority.md | store · `rugby-chess-state`             | 2          |
| 5   | tasks/05-vs-computer-mode.md         | domain + store + gating UI              | 3, 4       |
| 6   | tasks/06-easy-bot-engine.md          | application/ai (puro)                   | 2          |
| 7   | tasks/07-bot-store-actions.md        | store · `rugby-chess-state`             | 5, 6       |
| 8   | tasks/08-computer-turn-hook.md       | application hook                        | 7          |
| 9   | tasks/09-ui-vs-computer.md           | components · `add-ui-component`         | 5, 8       |
| 10  | tasks/10-final-verification.md       | verificación                            | all        |

Paralelizable: 1 con todo; 3 y 4 entre sí; 6 en paralelo con 3–5.

## Criterios de Aceptación Globales

- [ ] Ningún estado de PLAYING queda sin salida: pase automático o GAME_OVER.
- [ ] Con banca disponible se puede mover a casillas vacías fuera y dentro de las filas de despliegue.
- [ ] Reglas visibles dicen filas 2–4 / 8–10 y anotación en 11 / 1 (EN y ES).
- [ ] Menú ofrece "Play vs computer (Easy)"; el humano juega BLANCAS, el bot NEGRAS.
- [ ] El bot completa setup (ALTERNATING y HIDDEN), banca y partida sin intervención.
- [ ] El bot no actúa mientras se navega el historial ni fuera de su turno.
- [ ] El humano no puede actuar durante el turno del bot.
- [ ] `EasyBot.ts` es puro (sin React/Zustand) y testeado con `rng` determinista.
- [ ] PVP local y ONLINE sin regresiones (tests existentes pasan).
- [ ] Sin hex/fonts hardcodeados; named exports; cero `any`; `noUncheckedIndexedAccess` respetado.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pasan.

## Preguntas Abiertas / Supuestos

- **Supuesto:** humano siempre BLANCAS (mueve primero). Elegir color queda fuera de alcance.
- **Supuesto:** el bot usa un layout de quick start al azar para su setup (cumple todas las
  restricciones por construcción). Setup "creativo" del bot queda fuera de alcance.
- **Supuesto:** el pase es automático (sin botón "Pass"). Si se prefiere manual, cambiar solo
  Task 03.
- **Supuesto:** `lastPassedPlayer` se agrega al snapshot como campo opcional
  (retrocompatible). Si no se quiere tocar el contrato online, omitirlo del snapshot.
