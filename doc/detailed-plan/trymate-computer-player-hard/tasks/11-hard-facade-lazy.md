# Task 11: Fachada `HardBot` con carga diferida

> Parte del plan: `../plan.md` — ver principio 3 (peso aislado) y "Arquitectura".

## Skill / Capa

Application (ai) + store.

## Objetivo

Registrar "hard" como dificultad sin que su código entre al bundle principal: se descarga
recién cuando el usuario elige Hard.

## Depende De

- Task 07 (`HardBotClient`), Task 08 (bots async), Task 09 (setup), Task 04 (`loadHardWeights`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/HardBot.ts` — crear (+ test).
- `apps/web/src/lab/trymate/application/ai/ComputerPlayer.ts` — agregar loaders async.
- `apps/web/src/lab/trymate/application/GameState.ts` — `startVsComputer` async-safe.

## Detalles de Implementación

1. `ComputerPlayer.ts`:

```ts
export type BotDifficulty = "easy" | "medium" | "hard";
type Factory = (rng: Rng) => ComputerPlayer;
const LOADERS: Partial<Record<BotDifficulty, () => Promise<Factory>>> = {
  hard: () => import("./hard/HardBot").then((m) => m.createHardBot),
};
export async function loadComputerPlayer(d: BotDifficulty, rng: Rng): Promise<ComputerPlayer>; // registro sync o loader
```

`import()` dinámico es lo que hace que Vite cree un chunk aparte. **Ningún** otro archivo de
producción debe importar `ai/hard/**` de forma estática. 2. Store: nuevo campo `botPersonality: Personality` (default `"balanced"`); firma
`startVsComputer(mode, difficulty, personality = get().botPersonality)`; `playAgain()` conserva
ambos. La fábrica recibe la personalidad: `Factory = (rng: Rng, opts: { personality: Personality }) => ComputerPlayer`
(Easy/Medium la ignoran). `startVsComputer` sigue sync: crea el estado y deja
`botController: null`, `botLoading: true` si la dificultad necesita loader; dispara
`loadComputerPlayer(...).then(c => set({ botController: c, botLoading: false }))` (ignorar si el
token de partida cambió). `runBotTurn*` devuelve `false` mientras `botController` sea `null`; el
hook re-agenda cuando `botLoading` pasa a `false` (agregar a sus deps). 3. `HardBot.ts`:

```ts
export function createHardBot(
  rng: Rng,
  opts: { personality: Personality; overrides?: Partial<typeof HARD_BOT_CONFIG> },
): ComputerPlayer & { readonly lastResult: HardSearchResult | null; dispose(): void };
```

- Instancia un `HardBotClient`.
- `prepareSetupAsync(ctx, signal)`: pedir plan de setup al worker cuando no hay plan o cambió lo
  visible del rival (Task 09).
- `chooseSetupPlacement` / `chooseBenchType` (sync): `nextFromPlan` / `nextBenchFromPlan`; si no
  hay plan (fallo del worker) → delegar en el greedy de Medium.
- `choosePlayActionAsync(ctx, signal)`: `client.search(toHardRequest(ctx, HARD_BOT_CONFIG.budget, seed, id, opts.personality), signal)`;
  mapear `HardAction[]` → `BotPlayAction[]` (para `bench`, elegir el primer `benchPieceId` del
  tipo en `ctx.botState.getBenchPieces()`); guardar `lastResult`.
- `choosePlayAction` (sync, requerido por la interfaz): búsqueda inline con `fallbackBudget`.
- Si `loadHardWeights(...).stale` y `import.meta.env.DEV` → `console.warn` una vez:
  "Hard: pesos ajustados para otras reglas; usando defaults. Correr tuneHard."
- `dispose()` termina el worker; el store lo llama en `reset`/`startVsComputer` sobre el controller anterior
  (si tiene `dispose`).

## Fuera de Alcance

- UI (Task 12).

## Verificación

- [ ] Test de store: `startVsComputer(ALTERNATING, "hard")` → `botLoading` true, luego controller
      cargado; partida completa en jsdom (inline fallback, `HARD_BOT_CONFIG` con nodos bajos vía override de test).
- [ ] `dispose` se llama al reiniciar.
- [ ] `pnpm build` + inspeccionar `dist/assets`: existe un chunk con el código de Hard y el asset
      del worker; el chunk principal no contiene strings propios de Hard (ej. `"Hard: pesos"`).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate` + `pnpm typecheck` + `pnpm lint`

## Handoff

- Produce: dificultad "hard" funcional y aislada del bundle principal.
