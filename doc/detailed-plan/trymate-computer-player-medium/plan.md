# Plan: TryMate — Jugador Computadora nivel Medio (agnóstico de reglas)

## Objetivo

Agregar un rival "Medium" que piense más allá de la jugada inmediata: mira la respuesta del
humano (búsqueda de 2 jugadas), frena a las piezas rivales que se escapan, avanza en bloque
protegiendo sus piezas y adapta su despliegue a lo que ve del rival.

**Requisito de diseño central:** TryMate está en creación y van a cambiar tamaño de tablero,
filas, puntos y movimientos de piezas. El bot **no conoce ninguna regla por su cuenta**: todo lo
lee de las fuentes de verdad del juego (constantes + motor de movimientos) o lo **deriva
sondeando el motor** al iniciar. Cambiar las reglas no debe requerir tocar el bot para que
siga jugando legal y razonablemente.

## Fuente de Requerimientos

- Pedido del usuario: "un rival que piense un poco más allá… estrategias para que el
  contrincante no avance… avanzar en bloque y proteger sus piezas" + "que el bot se rija
  siempre por las reglas y tamaños de tablero de los otros archivos… agnóstico de esos
  parámetros".
- **Precondición:** el plan `doc/detailed-plan/trymate-computer-player/` está implementado
  (fixes P1–P3, `GameMode.VS_COMPUTER`, `ai/EasyBot.ts`, `rules/turnRules.ts`, `runBotTurn`,
  `useComputerTurn`). Al 2026-09-23 ya existen `EasyBot.ts` y `turnRules.ts` en el working tree.
  Si algún nombre difiere, manda el código.
- Código de reglas: `domain/constants/GameConstants.ts`, `GameRules.ts`, `PieceConstants.ts`,
  `application/rules/MovementRuleEngine.ts`, `application/rules/turnRules.ts`.
- Skills: `.devin/skills/rugby-chess-state`, `rugby-chess-domain`, `rugby-chess-code-review`
  (sus paths dicen `lab/rugby-chess`; aplicar sobre `apps/web/src/lab/trymate/`).

## Relación con `trymate-rules-agnostic-easy` (ejecutar ese plan primero)

El plan `doc/detailed-plan/trymate-rules-agnostic-easy/` implementa las bases compartidas. Si ya
está hecho, en este plan:

| Task de este plan | Estado tras el plan Easy agnóstico |
| --- | --- |
| 01 difficulty-plumbing | Parcial: `ComputerPlayer`, `BotContext`, `rng.ts`, `botController` y Easy agnóstico ya existen. Solo falta agregar `"medium"` a `BotDifficulty` y el parámetro `difficulty` en UI/store si no se hizo |
| 02 rules-single-source | Cubierta (Tasks 01–03 de ese plan). **Ojo:** `composition.ts` vive en `domain/rules/`, no en `application/rules/` |
| 03 sim-state | Cubierta (Task 08 de ese plan) |
| 13 tests-variants-arena | Parcial: `ruleVariants`, `arena.ts` y el test de variantes Easy ya existen; agregar Medium, umbrales, tácticas y perf |

Verificar cada una contra el código y saltear lo que ya esté.

## Principio: Reglas Agnósticas

### Fuentes de verdad (lo único que el bot consulta)

| Qué | De dónde lo obtiene el bot |
| --- | --- |
| Ancho / alto | `RulesView.width/height` (de `GAME_CONFIG`) |
| Filas de despliegue, fila de anotación, fila base, dirección | `RulesView.placementRows(p)`, `scoringRow(p)`, `homeRow(p)`, `forward(p)` |
| Piezas a colocar, banca, min/max por tipo, máx por fila, puntos para ganar | `RulesView` (de `GAME_RULES`) |
| Tipos de pieza existentes | `RulesView.pieceTypes` (= `Object.values(PieceType)`) |
| Movimientos legales | `engine.getValidMoves(piece, board)` |
| Casillas que una pieza capturaría | `engine.getCaptureSquares(piece, board)` (**nuevo**, Task 02) |
| Bloqueos (ej. costados del FORT) | `engine.canPassThrough(piece, square, board)` |
| Valor, alcance y "rol" de cada tipo | `PieceProfile` **derivado** sondeando el motor (Task 04) |
| Qué tipo le gana a cuál | `matchup[T][E]` **derivado** sondeando el motor (Task 04) |

### Reglas para el código del bot (`application/ai/**`)

1. Prohibido importar `GAME_RULES`, `GAME_CONFIG`, `PIECE_MOVEMENT_CONFIG` o `QUICK_START_LAYOUTS`
   (se enforcea con ESLint, Task 02). Se reciben por `BotContext.rules` / `BotContext.engine`.
2. Prohibido referenciar tipos concretos (`PieceType.FORT`, etc.). Se itera `rules.pieceTypes` y
   se decide por `PieceProfile` (ESLint `no-restricted-syntax`, Task 02).
3. Prohibido asumir geometría: nada de `10 − y`, `y + 1` o `x ± 1` fijos. Progreso, distancia a
   la meta, ventanas laterales y umbrales se calculan con `RulesView` y perfiles.
4. Umbrales dependientes del tamaño se expresan **relativos** (ej. `runnerZone = max(2, round(0.3 × (height − 1)))` → 3 con 11 filas).
5. Los pesos en `medium/config.ts` son números adimensionales; los valores por tipo son
   **overrides opcionales** sobre los derivados (`Partial<Record<string, number>>`, vacío por defecto).

### Agnóstico ≠ omnisciente (límite honesto)

- Si cambian tamaños, filas, puntos o patrones de movimiento/captura existentes: el bot sigue
  jugando legal (usa el motor) y sus heurísticas se recalibran solas (perfiles derivados).
- Si se inventa una **mecánica nueva** (ej. una pieza que salta, capturas en cadena): el bot
  la juega legal porque el motor la genera y la búsqueda la considera, pero ninguna heurística
  la "entiende" hasta agregar un término de evaluación. Los tests de variantes (Task 13) lo detectan.

## Cambios previos en el juego (para que las reglas tengan una sola fuente)

- `GameRules.ts` hoy tiene filas escritas a mano (`PLACEMENT_ROWS_PLAYER2: [7, 8, 9]`,
  `SCORING_ZONE_PLAYER1: 10`) que se rompen si cambia `BOARD_HEIGHT`. Se derivan de
  `GAME_CONFIG.BOARD_HEIGHT` + un nuevo `PLACEMENT_DEPTH: 3` (mismos valores con 11 filas).
- `MovementRuleEngine` tiene `3` y `2` literales para el PIONEER aunque el config ya declara
  `maxTotalDistance` y `bypassMinDistance`; y ramifica por `piece.type === PIONEER`. Se pasa a
  leer del config (flags `lShape`, `canBypassBlocker`) y se permite inyectar el config por
  constructor (`new MovementRuleEngine(config = PIECE_MOVEMENT_CONFIG)`) para tests de variantes.
- `turnRules.ts` acepta un `rules: RulesView = CURRENT_RULES` opcional.
- Nueva `composition.ts` (`isCompositionFeasible`) usada por store y bots para no quedar en
  despliegues imposibles si cambian min/max/cantidades.

## Arquitectura de la IA

```
domain/config/RulesView.ts        # RulesView + CURRENT_RULES + rulesFingerprint (Task 02)
domain/rules/composition.ts       # factibilidad de composición (Task 02 / plan Easy agnóstico)
application/ai/
  ComputerPlayer.ts          # interfaz común + registro por dificultad (Task 01)
  EasyBot.ts                 # se vuelve agnóstico (Task 01)
  rng.ts                     # createSeededRng (Task 01)
  sim/SimState.ts            # simulación rules-aware (Task 03)
  introspection/profiles.ts  # PieceProfile, matchup, geometría relativa (Task 04)
  analysis/boardAnalysis.ts  # ataques, defensas, avance, tapones, carriles (Task 05)
  medium/config.ts           # pesos adimensionales + overrides
  medium/evaluation.ts       # evaluación con desglose (Task 06)
  medium/posture.ts          # ATTACK / DEFEND / BALANCED (Task 07)
  medium/search.ts           # alfa-beta 2 (3 en finales) (Task 08)
  medium/benchPlacement.ts   # banca en juego (Task 09)
  medium/setupStrategy.ts    # despliegue y banca generados, sin coordenadas fijas (Task 10)
  MediumBot.ts               # fachada (Task 11)
  arena.ts                   # bot vs bot sobre SimState con reglas inyectables (Task 13)
```

### Contratos compartidos

```ts
// domain/config/RulesView.ts
export interface RulesView {
  width: number; height: number;
  pieceTypes: readonly PieceType[];
  piecesToPlace: number; benchSize: number;
  minPerType: number; maxPerType: number; maxPerRow: number;
  pointsToWin: number;
  placementRows(p: Player): readonly number[];
  homeRow(p: Player): number;     // 0 BLANCAS, height−1 NEGRAS
  scoringRow(p: Player): number;  // homeRow del rival
  forward(p: Player): 1 | -1;
}
export const CURRENT_RULES: RulesView;
export function rulesFingerprint(rules: RulesView, pieceConfig: unknown): string;

// application/ai/ComputerPlayer.ts
export type BotDifficulty = "easy" | "medium";
export interface BotContext {
  board: Board;              // en SETUP HIDDEN: solo piezas propias (sin espiar)
  bot: Player;
  botState: PlayerState;
  opponentState: PlayerState;
  engine: MovementRuleEngine;
  rules: RulesView;
  setupMode: SetupTurnMode;
  rng: Rng;
}
export interface ComputerPlayer {
  readonly difficulty: BotDifficulty;
  chooseSetupPlacement(ctx: BotContext): { type: PieceType; position: Position } | null;
  chooseBenchType(ctx: BotContext): PieceType | null;
  choosePlayAction(ctx: BotContext): BotPlayAction;
}
```

### Geometría relativa (Task 04, usada en todo el bot)

- `progress(p) = |y − rules.homeRow(owner)|`; `distToGoal(p) = |rules.scoringRow(owner) − y|`.
- `runnerZone = max(2, round(0.3 × (height − 1)))`.
- `laneWindow = max lateral reach entre todos los perfiles` (con reglas actuales = 1).
- `supportRadius = max alcance de captura entre perfiles + 1` (actual = 2).
- `endgamePieces = round(0.6 × 2 × piecesToPlace)` (actual = 6).

### Perfiles derivados (Task 04)

Se sondea el motor en un tablero vacío del tamaño de `rules`, con la pieza en el centro
(columna media, fila media) para que el alcance no quede recortado por bordes:

| Campo | Cómo se obtiene |
| --- | --- |
| `moveCount` | cantidad de `getValidMoves` en tablero vacío |
| `forwardReach` | máximo avance de progreso en una jugada |
| `lateralReach` | máximo `|dx|` en jugadas |
| `captureCount` / `captureReach` | tamaño y alcance máximo de `getCaptureSquares` |
| `blockPower` | casillas vecinas donde `canPassThrough` niega la entrada a sondas rivales de cada tipo (promedio) |
| `value` | `20 + 2·moveCount + 5·captureCount + 3·forwardReach + 4·blockPower`, normalizado a media 30 entre tipos; override opcional |
| `roles` | `runner` (sin captura o mayor `forwardReach`), `attacker` (captura > 0), `blocker` (`blockPower > 0`) |
| `matchup[T][E]` ∈ [−1, 1] | (casillas desde donde T ataca a E sin que E lo ataque) − (viceversa), normalizado |

Todo se memoiza por `rulesFingerprint`. Con las reglas actuales debe salir FORT = blocker +
attacker, STRIKER = attacker, PIONEER = runner, y `matchup[FORT][STRIKER] > 0`
(verificado en tests como **escenario de reglas actuales**, no como supuesto del código).

### Evaluación (desde el bot; `F_bot − F_rival` salvo aclaración)

| Término | Cálculo | Base |
| --- | --- | --- |
| Terminal | ganó → ±`winValue` (± profundidad restante) | — |
| Puntos | `score × pointValue` | 400 |
| Material | Σ `profile.value` en tablero + `benchFactor` × banca | 0.8 banca |
| Progreso | Σ `profile.forwardReach × progress` + `runnerBonus(d)` si `d ≤ runnerZone`, con `runnerBonus(d) = 60 / d^1.3` | — |
| Colgadas | pieza atacada: `−0.9·value` sin defensa, `−0.25·value` defendida; × 0.5 si su bando mueve | — |
| Cohesión | +6 si `progress ≥ runnerZone` y defendida; −8 si aislada (nada propio a `supportRadius`) sin carril libre; −5 por fila que el líder se adelanta sobre el segundo más allá de `max(2, round(0.2·height))` | — |
| Contención | por rival: −1 por cada jugada de avance que le queda; +12 si no le queda ninguna y hay pieza del bot adyacente por delante (tapón); +8 si todas sus casillas de avance están atacadas por el bot | — |
| Amenaza de corredor | solo al bot: rival con `d ≤ runnerZone + 1` y avance no controlado → `−1.5·runnerBonus(d)` | — |
| Carril libre | sin rivales por delante en `x ± laneWindow` → `+12 × (runnerZone + 2 − min(d, runnerZone + 2))` | — |
| Movilidad | `1.5 × jugadas legales` | — |

### Posturas, búsqueda, banca y despliegue

- **Posturas** (una vez por turno en la raíz): DEFEND si un rival tiene `d ≤ runnerZone` sin
  avance controlado o al rival le falta 1 punto; ATTACK si el bot tiene carril libre con
  `d ≤ runnerZone + 1`, ventaja material ≥ 25 o va ganando sin corredores rivales; si no,
  BALANCED. Multiplicadores: DEFEND (contención ×1.8, corredor ×1.8, colgadas ×1.2,
  progreso ×0.7), ATTACK (progreso ×1.4, carril ×1.5, cohesión ×0.8, contención ×0.8).
- **Búsqueda:** negamax alfa-beta, iterative deepening hasta 2 (3 si quedan ≤ `endgamePieces`),
  orden anotación > captura > avance, presupuesto 20 000 nodos, tolerancia 6 y 5 % de
  "segunda mejor" en la raíz. No simula banca rival (sí la cuenta como material).
- **Banca en juego:** siempre que se pueda; prueba cada tipo × cada casilla válida y evalúa.
- **Despliegue:** greedy generado (sin coordenadas fijas) con puntaje por roles, cobertura de
  carriles, defensa mutua, `matchup` contra piezas rivales visibles y composición objetivo
  derivada de los valores. En HIDDEN el mismo algoritmo sin información rival (tablero filtrado)
  + ruido para variar. Banca: primero factibilidad (`isCompositionFeasible`), después `matchup`.

## Pantallas / Componentes

| Componente | Cambio |
| --- | --- |
| `TryMatePage.tsx` | Selector de dificultad + botón "Play vs computer" |
| `components/DifficultySelector.tsx` | Nuevo organismo (radio group como `SetupModeSelector`) |
| `GameStatusBar.tsx` | Badge "Computer · Medium" |
| `lib/rulesContent.ts` | Línea sobre dificultades |

## Secuencia de Implementación

| # | Task file | Capa | Depende de |
| --- | --- | --- | --- |
| 1 | tasks/02-rules-single-source.md | domain + rules + lint | — (plan Easy implementado) |
| 2 | tasks/01-difficulty-plumbing.md | ai + store | Task 02 |
| 3 | tasks/03-sim-state.md | ai/sim | 2 |
| 4 | tasks/04-rules-introspection.md | ai/introspection | 2 |
| 5 | tasks/05-board-analysis.md | ai/analysis | 3, 4 |
| 6 | tasks/06-evaluation.md | ai/medium | 5 |
| 7 | tasks/07-posture.md | ai/medium | 5, 6 |
| 8 | tasks/08-search.md | ai/medium | 3, 6, 7 |
| 9 | tasks/09-bench-placement.md | ai/medium | 3, 6 |
| 10 | tasks/10-setup-strategy.md | ai/medium | 4, 5 |
| 11 | tasks/11-medium-bot-facade.md | ai + store | 1, 8, 9, 10 |
| 12 | tasks/12-ui-difficulty.md | components | 1 |
| 13 | tasks/13-tests-variants-arena.md | tests | 11 |
| 14 | tasks/14-final-verification.md | verificación | all |

**Orden de ejecución:** Task 02 va primero (el resto la necesita), luego Task 01. Task 12 en
cualquier momento después de 01; 04 en paralelo con 03; 09 y 10 en paralelo con 07–08.

## Criterios de Aceptación Globales

- [ ] `application/ai/**` no importa `GAME_RULES`, `GAME_CONFIG`, `PIECE_MOVEMENT_CONFIG` ni
      `QUICK_START_LAYOUTS`, ni referencia `PieceType.X` (ESLint en verde).
- [ ] Con reglas actuales: Medium gana ≥ 75 % de 40 partidas sembradas vs Easy.
- [ ] Con cada variante de reglas de Task 13 (tablero 7×13, profundidad de despliegue 2,
      patrones de FORT/STRIKER alterados): Easy y Medium completan partidas sin excepciones y
      solo con acciones legales; Medium gana ≥ 60 % vs Easy.
- [ ] Suite táctica de reglas actuales verde (frena corredores, tapona, no cuelga, captura
      indefensas, avanza en bloque, anota para ganar). Se saltea con aviso si cambia el fingerprint.
- [ ] Decisión < 150 ms (p95) con reglas actuales.
- [ ] En HIDDEN el bot nunca lee piezas rivales durante el SETUP.
- [ ] `CURRENT_RULES` coincide con `GAME_RULES`/`turnRules` actuales (test de equivalencia);
      PVP, Online y Easy sin regresiones.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pasan. Cero `any`.

## Preguntas Abiertas / Supuestos

- **Supuesto:** el juego sigue siendo una "carrera" de dos bandos en filas opuestas (hay
  fila base, fila de anotación y dirección de avance). Si eso cambia, `RulesView` cambia de forma.
- **Supuesto:** la fórmula de `value` y los multiplicadores son un punto de partida; se ajustan
  con la arena y `explainEvaluation`, sin tocar código fuera de `medium/config.ts`.
- **Supuesto:** mecánicas nuevas se juegan legal pero sin estrategia específica hasta sumar un término.
- **Supuesto:** el humano sigue jugando BLANCAS; profundidad 2 alcanza para "Medium".
- **Supuesto:** el store sigue ligado a las constantes globales; el bot recibe `CURRENT_RULES`
  en producción y variantes solo en tests (arena sobre `SimState`).
