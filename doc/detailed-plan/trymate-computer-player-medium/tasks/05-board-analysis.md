# Task 05: Análisis de tablero (sin conocimiento de piezas)

> Parte del plan: `../plan.md` — ver "Evaluación" (qué necesita cada término).

## Skill / Capa

Application pura (`application/ai/analysis/`).

## Objetivo

Primitivas de lectura del tablero —ataques, defensas, avance, tapones, carriles— calculadas
**solo** con el motor y `RulesInsight`, sin patrones por tipo.

## Depende De

- Task 03 (`SimState`, `opponentOf`), Task 04 (`RulesInsight`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/analysis/boardAnalysis.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/analysis/boardAnalysis.test.ts` — crear.

## Detalles de Implementación

Clave de casilla: `key(x, y)` → string `"x,y"`. Nunca construir `Position` con negativos.

```ts
export interface BoardAnalysis {
  attacks: Record<Player, Map<string, GamePiece[]>>;   // casilla → piezas que la capturarían
  legalMoves: Map<string, Position[]>;                  // pieceId → getValidMoves
  isAttacked(square: Position, by: Player): boolean;
  isDefended(piece: GamePiece): boolean;               // otra pieza propia la "atacaría" si un rival la captura
  advanceMoves(piece: GamePiece): Position[];          // jugadas legales a casilla vacía que suben progress
  isAdvanceControlled(piece: GamePiece, controller: Player): boolean; // todas sus casillas de avance atacadas u ocupadas por controller (o no tiene)
  isPlugged(piece: GamePiece, by: Player): boolean;    // 0 advanceMoves y hay pieza de `by` a Chebyshev 1 por delante
  hasFreeLane(piece: GamePiece): boolean;              // ningún rival por delante en |dx| ≤ laneWindow
  isIsolated(piece: GamePiece): boolean;               // ninguna propia a Chebyshev ≤ supportRadius
  legalMoveCount(player: Player): number;
}
export function analyzeBoard(board: Board, engine: MovementRuleEngine, insight: RulesInsight): BoardAnalysis;
```

- `attacks`: por cada pieza, `engine.getCaptureSquares(piece, board)`.
- `legalMoves`: una sola llamada a `getValidMoves` por pieza; el resto de funciones lo reutiliza.
- "Por delante" = `insight.progress` mayor (para el dueño de la pieza analizada, usando su
  dirección vía `rules.forward(owner)`).
- `isDefended(piece)`: `attacks[owner]` en la casilla de `piece` contiene otra pieza
  (el patrón de recaptura = patrón de captura).
- Todo cálculo por jugador usa `rules.forward`, `insight.progress`, `insight.geometry`; cero
  literales de tamaño o tipo.

## Fuera de Alcance

- No ponderar (Task 06).

## Verificación

- [ ] **Escenarios de reglas actuales** (tests con tipos concretos): FORT blanco en (2,4) ataca
      (1,5) y (3,5); STRIKER negro en (2,6) ataca (2,5); STRIKER blanco en (2,5) con FORT blanco en
      (1,4) está defendido; PIONEER negro en (2,7) con pieza blanca en (2,6) → `isPlugged` true.
- [ ] Variante 7×13 con motor alterado: `analyzeBoard` no lanza y `isAttacked` coincide con
      "poner rival y consultar `getValidMoves`" en 50 casillas aleatorias.
- [ ] Nada lanza con piezas en bordes.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/analysis` + `pnpm typecheck`

## Handoff

- Produce: `analyzeBoard` / `BoardAnalysis` para Tasks 06, 07, 09, 10.
