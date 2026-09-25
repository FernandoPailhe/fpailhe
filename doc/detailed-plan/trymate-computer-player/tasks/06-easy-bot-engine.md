# Task 06: Motor del bot fácil (`EasyBot.ts`, puro)

> Parte del plan: `../plan.md` — ver "Tipos del bot" y "Lógica Derivada" (bloque EasyBot).

## Skill / Capa

Capa application del módulo, **función pura** (sin React, sin Zustand). Reglas de
`.devin/rules/rules.md` (TS estricto, named exports, sin `any`).

## Objetivo

Implementar las decisiones del bot (setup, banca, jugada) con `rng` inyectable para tests
deterministas.

## Depende De

- Task 02: `getBenchPlacementSquares`, `canPlaceFromBench`, `getScoringRow`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/EasyBot.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/EasyBot.test.ts` — crear.

## Detalles de Implementación

```ts
export type Rng = () => number;

export type BotPlayAction =
  | { kind: "bench"; benchPieceId: string; to: Position }
  | { kind: "move"; pieceId: string; to: Position }
  | { kind: "pass" };

export interface EasyBotConfig {
  randomMoveChance: number;
  topK: number;
  weights: {
    score: number;
    capture: number;
    advancePerRow: number;
    threatened: number;
    noise: number;
  };
}

export const EASY_BOT_CONFIG: EasyBotConfig = {
  randomMoveChance: 0.3,
  topK: 3,
  weights: { score: 100, capture: 30, advancePerRow: 3, threatened: -15, noise: 5 },
};

export function pickBotLayoutId(rng: Rng): string; // id de QUICK_START_LAYOUTS
export function nextSetupPlacement(
  board: Board,
  bot: Player,
  layout: QuickStartLayout,
): { type: PieceType; position: Position } | null; // primera pieza del layout cuya casilla no tiene pieza propia
export function nextBenchType(playerState: PlayerState, layout: QuickStartLayout): PieceType | null;
export function getThreatenedSquares(board: Board, bot: Player): Set<string>; // claves "x,y"
export function choosePlayAction(
  board: Board,
  bot: Player,
  playerState: PlayerState,
  engine: MovementRuleEngine,
  rng: Rng,
  config: EasyBotConfig = EASY_BOT_CONFIG,
): BotPlayAction;
```

- `layout` que recibe el bot ya está espejado: el llamador usa
  `resolveQuickStartLayout(bot, layoutId)` (de `domain/config/QuickStartLayout.ts`).
- `nextBenchType`: contar tipos de `layout.benchPieces` menos los de
  `playerState.getBenchPieces()`; devolver el primero con remanente > 0.
- `getThreatenedSquares`: por cada pieza rival con `position`:
  `dir = piece.getDirectionMultiplier()`; FORT → `(x±1, y+dir)`; STRIKER → `(x, y+dir)`;
  descartar fuera de tablero (`x` 0..4, `y` 0..10) **antes** de construir `Position` (el
  constructor lanza con negativos).
- `choosePlayAction`, en orden:
  1. Si `canPlaceFromBench(...)` y hay squares: tomar `playerState.getBenchPieces()[0]`,
     filtrar las squares de la fila más adelantada (máx `y` para BLANCAS, mín `y` para NEGRAS)
     y elegir una con `rng`. Devolver `bench`.
  2. Candidatos: por cada pieza propia en tablero, `engine.getValidMoves(piece, board)`.
  3. Puntaje por candidato:
     `advance = (to.y - from.y) * dir * advancePerRow`;
     `+ score` si `to.y === getScoringRow(bot)`; `+ capture` si `board.getPieceAt(to)` es rival;
     `+ threatened` si `to` ∈ amenazadas; `+ rng() * noise`.
  4. Sin candidatos → `{ kind: "pass" }`. Si `rng() < randomMoveChance` → candidato al azar.
     Si no → ordenar desc y elegir al azar entre los primeros `topK`.
- Índices aleatorios: `Math.floor(rng() * arr.length)` con guard por `noUncheckedIndexedAccess`.
- **No mutar** `board` ni piezas.

## Fuera de Alcance

- No tocar el store ni componentes. No implementar minimax ni niveles medio/difícil.

## Verificación

- [ ] Tests con `rng` fijo (ej. `() => 0.99` para evitar la rama aleatoria y `() => 0` para forzarla):
  - prefiere anotar cuando una pieza puede llegar a la fila de anotación;
  - prefiere capturar frente a avanzar 1;
  - con banca disponible y < 5 piezas devuelve `bench` en una square válida;
  - sin piezas movibles y sin banca → `pass`;
  - `nextSetupPlacement` recorre las 5 piezas del layout y luego devuelve `null`;
  - `nextBenchType` completa exactamente `layout.benchPieces`;
  - `getThreatenedSquares` no lanza con piezas en bordes (x=0, y=0/10).
  - El `board` queda igual tras `choosePlayAction` (comparar `getAllPieces()` antes/después).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai`
- [ ] `pnpm typecheck`

## Handoff

- Produce: API pura del bot consumida por `runBotTurn` (Task 07).
