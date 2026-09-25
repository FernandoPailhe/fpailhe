# Task 07: Web Worker para la búsqueda

> Parte del plan: `../plan.md` — ver "Contratos compartidos" (`HardRequest`/`HardResponse`) y principio 3.

## Skill / Capa

Application (`ai/hard/`). Stack fijo del repo: Vite soporta workers nativos
(`new Worker(new URL(...), { type: "module" })`); no agregar dependencias.

## Objetivo

Que Hard piense hasta ~800 ms sin congelar la UI, con un cliente que funciona igual en tests
(jsdom, sin Worker) usando un fallback en el hilo principal.

## Depende De

- Task 06 (`searchHard`). Del plan Easy agnóstico: `buildRulesView`, `RulesSource`, motor configurable.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/protocol.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/runHardRequest.ts` — crear (lógica pura compartida).
- `apps/web/src/lab/trymate/application/ai/hard/hard.worker.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/HardBotClient.ts` — crear.
- Tests: `protocol.test.ts`, `HardBotClient.test.ts`.

## Detalles de Implementación

1. `protocol.ts`: tipos `HardRequest`/`HardResponse` del plan, con un discriminante
   `kind: "play" | "setup"` (el de setup lo completa Task 09: agrega `setupMode` y devuelve un
   `ArmyPlan` serializado; dejar el tipo preparado como unión) +
   `toHardRequest(ctx: BotContext, budget, seed, id, personality): HardRequest` (serializa piezas, banca,
   puntajes, `ctx.rules` → `RulesSource` + dimensiones, `ctx.engine.config`) y agrega
   `personality: Personality` al request (campo nuevo en `HardRequest`).
   Agregar a `RulesView.ts` (plan Easy) una función `toRulesSource(view)` si no existe.
2. `runHardRequest(req): HardSearchResult` — **pura**: reconstruye `RulesView` (`buildRulesView`),
   `new MovementRuleEngine(req.pieceConfig)`, `Board` + piezas, `SimState` → `SearchBoard`,
   `getRulesInsight`, `loadHardWeights`, `getPersonalityProfile(req.personality)`, `createSeededRng(req.seed)`,
   llama `searchHard`. Mantener una `TranspositionTable` módulo-local reutilizada entre requests con el
   mismo **fingerprint + personalidad** (la evaluación depende de la personalidad: si cambia, `clear()`).
3. `hard.worker.ts`:

```ts
self.onmessage = (e: MessageEvent<HardRequest>) => {
  try {
    self.postMessage({
      id: e.data.id,
      ok: true,
      result: runHardRequest(e.data),
    } satisfies HardResponse);
  } catch (err) {
    self.postMessage({ id: e.data.id, ok: false, error: String(err) } satisfies HardResponse);
  }
};
```

4. `HardBotClient`:

```ts
export class HardBotClient {
  constructor(opts?: { forceInline?: boolean });
  search(req: HardRequest, signal: AbortSignal): Promise<HardSearchResult>;
  dispose(): void;
}
```

- Si `typeof Worker !== "undefined"` y no `forceInline`: crear worker perezosamente con
  `new Worker(new URL("./hard.worker.ts", import.meta.url), { type: "module" })`; mapear
  respuestas por `id`; en `abort` → `worker.terminate()` y recrear en la próxima búsqueda
  (única forma de cortar un cálculo en curso); rechazar con `AbortError`.
- Si no hay Worker: ejecutar `runHardRequest` en el hilo con `budget = HARD_BOT_CONFIG.fallbackBudget`
  dentro de `await Promise.resolve()` (respeta `signal` antes/después).
- Timeout de seguridad: `budget.ms + 1500` → terminar worker y reintentar una vez inline con el fallback.

## Fuera de Alcance

- Integración con el store (Tasks 08 y 11).

## Verificación

- [ ] `toHardRequest` → `structuredClone` sin errores y `runHardRequest` da el mismo resultado que
      llamar `searchHard` directo (modo nodos).
- [ ] Cliente en jsdom (sin Worker): resuelve con fallback; `abort` antes de terminar → rechaza con `AbortError`.
- [ ] Cliente con Worker falso (mock de clase que ejecuta `runHardRequest` en `setTimeout`): ids
      mapeados, abort termina el worker.
- [ ] `pnpm build` genera un asset separado para el worker (listar `dist/assets`).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard` + `pnpm typecheck`

## Handoff

- Produce: `HardBotClient.search`, `toHardRequest`, `runHardRequest`.
