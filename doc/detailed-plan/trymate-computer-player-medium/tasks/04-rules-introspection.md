# Task 04: Introspección de reglas (perfiles, matchups, geometría)

> Parte del plan: `../plan.md` — ver "Geometría relativa" y "Perfiles derivados".

## Skill / Capa

Application pura (`application/ai/introspection/`).

## Objetivo

Que el bot **descubra** qué hace cada tipo de pieza sondeando el motor, en vez de tener
conocimiento escrito a mano. Si mañana cambia un movimiento, los perfiles cambian solos.

## Depende De

- Task 02: `RulesView`, `rulesFingerprint`, `getCaptureSquares`, motor configurable.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/introspection/profiles.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/introspection/profiles.test.ts` — crear.

## Detalles de Implementación

```ts
export type PieceRole = "runner" | "attacker" | "blocker";
export interface PieceProfile {
  type: PieceType;
  moveCount: number; forwardReach: number; lateralReach: number;
  captureCount: number; captureReach: number; blockPower: number;
  value: number; roles: ReadonlySet<PieceRole>;
}
export interface RulesInsight {
  rules: RulesView;
  profiles: ReadonlyMap<PieceType, PieceProfile>;
  matchup: (attacker: PieceType, target: PieceType) => number; // [−1, 1]
  geometry: { runnerZone: number; laneWindow: number; supportRadius: number; endgamePieces: number; stretchSlack: number };
  progress(piece: GamePiece): number;
  distToGoal(piece: GamePiece): number;
}
export function getRulesInsight(rules: RulesView, engine: MovementRuleEngine, pieceConfigForFingerprint: unknown, valueOverrides?: Partial<Record<PieceType, number>>): RulesInsight;
```

Sondeo (tablero vacío `new Board(rules.width, rules.height)`, pieza BLANCAS en
`(floor(width/2), floor(height/2))`, id `"probe"`):

- `moves = engine.getValidMoves(probe, board)`: `moveCount`, `forwardReach = max((to.y − y) × forward)`,
  `lateralReach = max |to.x − x|`.
- `caps = engine.getCaptureSquares(probe, board)`: `captureCount`, `captureReach = max(|dx|, |dy|)`.
- `blockPower`: para cada vecina `N` (Chebyshev 1, dentro del tablero) y cada tipo `E`, poner una
  sonda NEGRAS de tipo `E` en `N − forward(NEGRAS)` (una fila antes de entrar a `N` desde su
  lado; saltear si cae fuera o sobre la pieza) y contar si `!engine.canPassThrough(sonda, N, board)`.
  `blockPower = conteo / cantidad de tipos`.
- `value = 20 + 2·moveCount + 5·captureCount + 3·forwardReach + 4·blockPower`, luego escalar para
  que el promedio entre tipos sea 30; `valueOverrides[type]` reemplaza si existe.
- `roles`: `attacker` si `captureCount > 0`; `blocker` si `blockPower > 0`; `runner` si
  `captureCount === 0` o `forwardReach` es el máximo entre tipos.
- `matchup(T, E)`: `E` NEGRAS en el centro; contar casillas `S` (tablero vacío) donde una `T`
  BLANCAS en `S` tiene la casilla de `E` en `getCaptureSquares` **y** `E` no tiene `S` en las
  suyas (= ataque seguro) → `a`. Repetir invertido (E ataca a T sin respuesta) → `b`.
  `matchup = (a − b) / max(1, a + b)`.
- `geometry`: `runnerZone = max(2, round(0.3·(height − 1)))`;
  `laneWindow = max(1, max lateralReach)`; `supportRadius = max captureReach + 1`;
  `endgamePieces = round(0.6 · 2 · piecesToPlace)`; `stretchSlack = max(2, round(0.2·height))`.
- `progress(p) = |y − rules.homeRow(owner)|`; `distToGoal(p) = |rules.scoringRow(owner) − y|`.
- Memo por `rulesFingerprint(rules, pieceConfigForFingerprint)` + overrides (Map módulo-local).

## Fuera de Alcance

- No ponderar posiciones (Task 06).

## Verificación

- [ ] **Escenario de reglas actuales** (test que sí nombra tipos, está permitido en `*.test.ts`):
      FORT roles ⊇ {attacker, blocker}; STRIKER ⊇ {attacker}; PIONEER ⊇ {runner} sin attacker;
      `matchup(FORT, STRIKER) > 0`; `geometry.runnerZone === 3`, `endgamePieces === 6`.
- [ ] Variante: motor con STRIKER capturando en diagonal además de frente → su `captureCount`
      sube y `matchup(FORT, STRIKER)` baja.
- [ ] Variante 7×13: `runnerZone === 4`; perfiles calculados sin excepciones.
- [ ] Memo: dos llamadas con mismas reglas devuelven el mismo objeto.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/introspection` + `pnpm typecheck`

## Handoff

- Produce: `getRulesInsight`, `PieceProfile`, `RulesInsight` para Tasks 05–10.
