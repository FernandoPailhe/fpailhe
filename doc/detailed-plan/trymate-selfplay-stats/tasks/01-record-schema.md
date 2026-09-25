# Task 01: Esquema de registro de partida y codificación de posiciones

> Parte del plan: `../plan.md` — ver "Registro de partida (`trymate.game/1`)".

## Skill / Capa

`selfplay/core` (TS puro). Reglas de `.devin/rules/rules.md` (TS estricto, named exports, cero `any`).

## Objetivo

Definir el formato versionado de una partida, su validación y una codificación compacta de
posiciones, independiente del tamaño del tablero y de los tipos de pieza.

## Depende De

- Nada (usa tipos existentes: `Player`, `PieceType`, `RulesView`, `PieceMovementConfigMap`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/core/record.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/core/positionCodec.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/core/record.test.ts`, `positionCodec.test.ts` — crear.

## Detalles de Implementación

1. `record.ts`: interfaces `GameRecord`, `PlyRecord`, `PlayerSpec`, `SideMetrics`,
   `RulesViewSnapshot` exactamente como en `../plan.md` más:

```ts
export const GAME_RECORD_SCHEMA = "trymate.game/1" as const;
export interface PlayerSpec {
  bot: string;
  difficulty: string;
  personality?: string;
  budget?: { kind: "nodes"; n: number };
  configHash: string;
}
export interface SideMetrics {
  avgFrontProgress: number;
  maxProgress: number;
  pliesToFirstScore: number | null;
  capturesMade: number;
  piecesLost: number;
  opponentMaxProgress: number;
  benchDrops: number;
  randomActions: number;
}
export interface RulesViewSnapshot {
  width: number;
  height: number;
  pieceTypes: string[];
  piecesToPlace: number;
  benchSize: number;
  minPerType: number;
  maxPerType: number;
  maxPerRow: number;
  pointsToWin: number;
  placementRows: Record<Player, number[]>;
}
export function snapshotRules(rules: RulesView): RulesViewSnapshot;
export function rulesFromSnapshot(s: RulesViewSnapshot): RulesView; // vía buildRulesView
export function validateGameRecord(
  value: unknown,
): { ok: true; record: GameRecord } | { ok: false; errors: string[] };
```

`validateGameRecord` a mano (sin librerías): schema, campos obligatorios, tipos, coherencia
(`result.plies === plies.length`, jugadores válidos, coordenadas dentro de `view`). 2. `positionCodec.ts`:

```ts
/** "<current>|<scoreB>,<scoreN>|<benchB>|<benchN>|<pieces>" con piezas "T<o><x>.<y>" separadas por ";".
 *  T = índice del tipo en rules.pieceTypes (base 36), o = b|n. Orden de piezas: por (y, x). */
export function encodePosition(sim: SimState): string;
export function decodePosition(code: string, rules: RulesView): SimState; // ids sintéticos "p<i>"
```

Banca codificada como índices de tipo concatenados (ej. `"012"`). Independiente del tamaño.

## Fuera de Alcance

- Escribir archivos (Task 05). Grabar partidas (Task 03).

## Verificación

- [ ] `encode → decode → encode` idéntico para 500 posiciones aleatorias (reglas actuales y 7×13).
- [ ] `validateGameRecord` acepta un registro de ejemplo válido y rechaza 6 casos rotos con errores claros.
- [ ] Tamaño: posición típica de mitad de partida ≤ 80 caracteres.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/selfplay` + `pnpm typecheck`

## Handoff

- Produce: tipos de registro, `validateGameRecord`, `snapshotRules`, `encodePosition`/`decodePosition`.
