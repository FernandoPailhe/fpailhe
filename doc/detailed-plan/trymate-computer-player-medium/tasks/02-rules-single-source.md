# Task 02: Reglas con una sola fuente de verdad + guardas de lint

> **Si `trymate-rules-agnostic-easy` está implementado:** esta tarea está cubierta (Tasks 01–03 de ese plan). Solo verificar; `composition.ts` está en `domain/rules/`.

> Parte del plan: `../plan.md` — ver "Cambios previos en el juego" y "Reglas para el código del bot".

## Skill / Capa

`.devin/skills/rugby-chess-domain/SKILL.md` (constantes) + `rugby-chess-state` (motor).

## Objetivo

Que tamaño de tablero, filas y patrones de piezas se cambien en **un solo lugar** y que
store, motor y bots los lean de ahí. Sin cambios de comportamiento con las reglas actuales.

## Depende De

- Nada.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/domain/constants/GameRules.ts` — editar (derivar filas).
- `apps/web/src/lab/trymate/domain/constants/PieceConstants.ts` — editar (flags de mecánica).
- `apps/web/src/lab/trymate/domain/config/RulesView.ts` — crear (+ test).
- `apps/web/src/lab/trymate/application/rules/MovementRuleEngine.ts` — editar.
- `apps/web/src/lab/trymate/application/rules/MovementRuleEngine.test.ts` — agregar contrato.
- `apps/web/src/lab/trymate/application/rules/turnRules.ts` — parámetro `rules` opcional.
- `apps/web/src/lab/trymate/domain/rules/composition.ts` — crear (+ test).
- `apps/web/src/lab/trymate/application/GameState.ts` — usar `isCompositionFeasible` en `canSelectPieceType`/`canSelectBenchPieceType`.
- `eslint.config.js` — override para `apps/web/src/lab/trymate/application/ai/**`.

## Detalles de Implementación

1. **GameRules derivado** (mismos valores con `BOARD_HEIGHT = 11`):

```ts
const H = GAME_CONFIG.BOARD_HEIGHT;
const PLACEMENT_DEPTH = 3;
const rowsFrom = (home: number, dir: 1 | -1) => Array.from({ length: PLACEMENT_DEPTH }, (_, i) => home + dir * (i + 1));
export const GAME_RULES = {
  ...,
  PLACEMENT_DEPTH,
  PLACEMENT_ROWS_PLAYER1: rowsFrom(0, 1),          // [1,2,3]
  PLACEMENT_ROWS_PLAYER2: rowsFrom(H - 1, -1).reverse(), // [7,8,9]
  SCORING_ZONE_PLAYER1: H - 1,
  SCORING_ZONE_PLAYER2: 0,
  FORBIDDEN_ZONE_PLAYER1: 0,
  FORBIDDEN_ZONE_PLAYER2: H - 1,
} as const;
```
   Si `as const` con arrays calculados rompe tipos, tiparlos `readonly number[]`.
2. **RulesView** (`domain/config/RulesView.ts`): interfaz del plan, `buildRulesView(config, rules)`,
   `CURRENT_RULES`, `rulesFingerprint(rules, pieceConfig)` = `JSON.stringify` estable de
   primitivas + filas por jugador + config de piezas.
3. **Motor data-driven:**
   - Constructor `constructor(public readonly config = PIECE_MOVEMENT_CONFIG)` (público: los bots lo usan para el fingerprint); reemplazar
     todos los `PIECE_MOVEMENT_CONFIG[...]` por `this.config[...]`.
   - PIONEER: usar `config.maxTotalDistance` y `config.bypassMinDistance` en vez de `3` y `2`;
     reemplazar `piece.type === PieceType.PIONEER` por flag `lShape: true` en el config y
     `canBypassBlocker` para el sorteo. (Agregar `lShape: true` al config de PIONEER; tipar el
     config con una interfaz `PieceMovementConfig` con campos opcionales.)
   - Bloqueo lateral: ya depende de `blocksSides`; quitar el `type !== FORT` y usar solo el flag.
   - Nuevo método público:

```ts
/** Casillas que `piece` capturaría si hubiera una pieza rival ahí (patrón de captura + bloqueos). */
getCaptureSquares(piece: GamePiece, board: Board): Position[];
```
   Implementar con `capture.directions × [minDistance..maxDistance]` ajustado por dirección,
   dentro del tablero, filtrado por `canPassThrough`. Agregarlo a `IMovementRule`.
4. **Test de contrato** (protege contra drift si cambian reglas): 200 tableros aleatorios
   sembrados; para cada pieza: (a) toda captura de `getValidMoves` ∈ `getCaptureSquares`;
   (b) para cada casilla de `getCaptureSquares`, en un clon con una pieza rival ahí,
   esa casilla ∈ `getValidMoves`.
5. **turnRules:** cada función acepta `rules: RulesView = CURRENT_RULES` como último parámetro
   y lee filas, ancho, máximos desde ahí.
6. **composition.ts:**

```ts
export function isCompositionFeasible(counts: Record<PieceType, number>, remainingSlots: number, rules: RulesView): boolean;
// true si ∀t counts[t] ≤ max, Σ max(0, min − counts[t]) ≤ remainingSlots, y Σ (max − counts[t]) ≥ remainingSlots
export function feasibleTypes(counts: Record<PieceType, number>, remainingSlots: number, rules: RulesView): PieceType[];
// tipos t tales que sumar uno sigue siendo factible con remainingSlots − 1
```
7. **ESLint** (agregar bloque en `eslint.config.js`):

```js
{
  files: ["apps/web/src/lab/trymate/application/ai/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", { paths: [
      { name: "../../domain/constants/GameRules", importNames: ["GAME_RULES"], message: "Usar ctx.rules (RulesView)." },
      { name: "../../domain/constants/GameConstants", importNames: ["GAME_CONFIG"], message: "Usar ctx.rules (RulesView)." },
      { name: "../../domain/constants/PieceConstants", importNames: ["PIECE_MOVEMENT_CONFIG"], message: "Usar ctx.engine." },
      { name: "../../domain/config/QuickStartLayout", message: "El bot genera su despliegue." },
    ], patterns: [{ group: ["**/GameConstants", "**/QuickStartLayout"], message: "Usar ctx.rules." }] }],
    "no-restricted-syntax": ["error", { selector: "MemberExpression[object.name='PieceType']", message: "No referenciar tipos concretos; usar rules.pieceTypes y PieceProfile." }],
  },
},
```
   Ajustar rutas relativas si hay subcarpetas (`../../../`); preferir `patterns` con `**/`.
   Los `*.test.ts` de `ai/` quedan excluidos de `no-restricted-syntax` (escenarios de reglas actuales).

## Fuera de Alcance

- No cambiar ningún valor de reglas. No tocar UI (los componentes siguen con `GAME_CONFIG`).

## Verificación

- [ ] Test: `CURRENT_RULES.placementRows(BLANCAS)` = `[1,2,3]`, NEGRAS = `[7,8,9]`, scoring 10/0.
- [ ] Test: `buildRulesView` con alto 13 da filas `[1,2,3]` / `[9,10,11]` y scoring 12/0.
- [ ] Test de contrato del motor verde; todos los tests existentes de `MovementRuleEngine` verdes.
- [ ] Test: `new MovementRuleEngine(configAlterado)` cambia los movimientos (ej. FORT con captura frontal).
- [ ] `isCompositionFeasible`: casos límite con min/max actuales y con min 3 / 4 tipos ficticios.
- [ ] `pnpm lint` verde (y falla si se agrega `import { GAME_RULES }` en `ai/`).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate` + `pnpm typecheck`

## Handoff

- Produce: `RulesView`, `CURRENT_RULES`, `rulesFingerprint`, `getCaptureSquares`, motor
  configurable, `isCompositionFeasible`/`feasibleTypes`, guardas de lint.
