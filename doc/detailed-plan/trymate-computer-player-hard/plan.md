# Plan: TryMate — Jugador Computadora nivel Difícil (Hard)

## Objetivo

Un rival que le cueste ganar a un jugador con experiencia: calcula varias jugadas adelante
(4–6 medias jugadas, más en finales), entiende carreras de corredores y cambios de piezas,
considera bajadas de banca de ambos lados y usa pesos ajustados por auto-juego. Sigue siendo
**agnóstico de reglas** y **no agrega peso al bundle principal** (se carga aparte y piensa en un
Web Worker para no congelar la UI).

Tiene tres **personalidades** seleccionables —**ofensivo**, **defensivo** y **equilibrado**— que
cambian su estilo de juego sin cambiar su nivel.

## Fuente de Requerimientos

- Pedido del usuario: "genera un plan para un jugador hard" + "soportar diferentes personalidades
  de jugador: ofensivo, defensivo y equilibrado", en continuidad con Easy (implementado),
  `trymate-rules-agnostic-easy` y `trymate-computer-player-medium`, y la preocupación por el peso
  del build (respuesta: se mide y se aísla en un chunk propio).
- **Precondiciones:** implementados `trymate-rules-agnostic-easy` (RulesView, motor configurable,
  `getCaptureSquares`, composición, `ComputerPlayer`, `SimState`, arena, variantes) y
  `trymate-computer-player-medium` (introspección, `analyzeBoard`, evaluación, posturas,
  búsqueda base, banca, setup, tácticas). Si un nombre difiere, manda el código.
- Skills: `.devin/skills/rugby-chess-state`, `rugby-chess-domain`, `rugby-chess-code-review`
  (paths `lab/rugby-chess` → `apps/web/src/lab/trymate/`), `.devin/rules/rules.md`.

## Qué agrega Hard sobre Medium

| Área                 | Medium                                         | Hard                                                                              |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Profundidad          | 2 (3 en finales), clonando tableros            | Iterative deepening por **tiempo** (≈ 800 ms) → típicamente 4–6, finales 8+       |
| Estado de búsqueda   | `SimState` inmutable (clona `Board` por nodo)  | `SearchBoard` mutable con **make/unmake** + hash Zobrist incremental              |
| Poda y orden         | alfa-beta, orden simple                        | PVS + tabla de transposición + killer moves + history heuristic                   |
| Efecto horizonte     | —                                              | **Quiescence**: extiende capturas, anotaciones y corredores a ≤ 1 jugada          |
| Banca en la búsqueda | Solo la propia, en la raíz                     | Bajadas de **ambos** bandos como acciones de la búsqueda (top-K)                  |
| Evaluación           | Términos a mano                                | + intercambio estático (SEE), **carrera de corredores**, pesos **auto-ajustados** |
| Setup                | Greedy por reglas de rol                       | Muestreo de ejércitos candidatos evaluados con búsqueda corta                     |
| Variedad             | Tolerancia 6 + 5 % "segunda mejor"             | Sin errores deliberados; azar solo entre jugadas empatadas (±1)                   |
| Dónde corre          | Hilo principal                                 | **Web Worker** en chunk lazy (fallback en hilo con presupuesto de nodos)          |
| Estilo               | Una sola forma de jugar (posturas automáticas) | **Personalidad** elegible: ofensivo / defensivo / equilibrado                     |

## Principios

1. **Agnóstico de reglas** (igual que Medium): nada de `GAME_RULES`/`GAME_CONFIG`/
   `PIECE_MOVEMENT_CONFIG`/`PieceType.X` en `ai/**`; todo por `RulesView`, motor e introspección.
   Las claves Zobrist se generan desde `width × height × pieceTypes × players`.
2. **Determinismo testeable:** modo `budget: { kind: "nodes", n }` sin reloj para tests y
   arena; modo `{ kind: "time", ms }` en producción.
3. **Peso aislado:** todo `ai/hard/**` se importa solo por `import()` dinámico y dentro del worker.
   El chunk principal no crece (se verifica en Task 14).
4. **Pesos ligados a reglas:** `hard/weights.json` guarda el `rulesFingerprint` con el que se
   ajustó. Si las reglas cambian, Hard usa los pesos por defecto de Medium y avisa en dev hasta
   re-ajustar con el script (Task 10).

## Personalidades

**Idea:** la personalidad es un **perfil de datos** (`hard/personalities.ts`) que se aplica
encima de los pesos base ajustados. No hay código distinto por personalidad: los mismos
algoritmos leen el perfil. Así se pueden agregar personalidades nuevas editando datos.

| Palanca                                                      | Ofensivo                                                        | Defensivo                                                                 | Equilibrado          |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| Qué valora más (multiplicadores por término y **por bando**) | Su propio progreso, carriles libres y carreras; arriesga piezas | Frenar corredores rivales, taponar, bloque compacto; teme el avance rival | Neutro               |
| Postura (umbrales)                                           | Entra en ATTACK antes y en DEFEND más tarde                     | DEFEND antes, ATTACK solo con ventaja clara                               | Los de Medium        |
| Final bloqueado / sin ganador (`contempt`)                   | Lo evita (−60)                                                  | Lo acepta (+30)                                                           | 0                    |
| Desempate entre jugadas casi iguales (≤ 8 pts)               | La que más avanza                                               | La que deja menos piezas propias atacadas                                 | Mejor score          |
| Setup                                                        | Más corredores, piezas adelante                                 | Más bloqueadores, líneas atrás                                            | Composición derivada |

**Regla de oro:** estilo sí, nivel no. Cada personalidad debe ganarle a Medium con margen y
quedar entre 40 % y 60 % contra `balanced`. Se verifica en la arena (Task 13), junto con
**métricas de estilo** (progreso medio del frente, jugadas hasta el primer punto, capturas,
piezas perdidas, avance máximo permitido al rival) que confirman que cada una juega distinto.

Los pesos base se ajustan con `balanced` vs `balanced`; los multiplicadores de personalidad
quedan fijos (opcionalmente se afinan con SPSA + métrica de estilo, Task 10).
El tipo `Personality` vive en `ai/personality.ts` para que Medium pueda adoptarlo más adelante.

## Arquitectura

```
domain/entities/Board.ts            # índice de posiciones O(1) (Task 01)
application/ai/
  ComputerPlayer.ts                 # + soporte de bots asíncronos y carga lazy (Tasks 08, 11)
  personality.ts                    # tipo Personality compartido (Task 05)
  hard/
    SearchBoard.ts                  # make/unmake + Zobrist (Task 02)
    zobrist.ts, transposition.ts    # hash y TT (Task 03)
    see.ts, race.ts, evaluation.ts  # evaluación Hard (Task 04)
    personalities.ts                # perfiles de personalidad (Task 05)
    weights.json, weights.ts        # pesos ajustados + fingerprint (Tasks 04, 10)
    search.ts                       # PVS + quiescence + banca (Task 06)
    setup.ts                        # setup por muestreo (Task 09)
    protocol.ts, hard.worker.ts, HardBotClient.ts   # worker (Task 07)
    HardBot.ts                      # fachada (Task 11)
  testing/tuneHard.ts               # SPSA por auto-juego, solo dev (Task 10)
```

### Contratos compartidos

```ts
// hard/search.ts
export type SearchBudget = { kind: "time"; ms: number } | { kind: "nodes"; n: number };
export type HardAction =
  | { kind: "move"; pieceId: string; to: { x: number; y: number } }
  | { kind: "bench"; type: PieceType; to: { x: number; y: number } }
  | { kind: "pass" };
export interface HardSearchResult {
  actions: HardAction[];
  score: number;
  depth: number;
  nodes: number;
  pv: HardAction[];
  ms: number;
}
// `actions` = lo que el bot hace este turno: 0..k bajadas de banca + 1 movimiento (o pass).

// hard/protocol.ts — todo serializable (structured clone)
export interface HardRequest {
  id: number;
  pieces: { id: string; type: PieceType; owner: Player; x: number; y: number }[];
  bench: Record<Player, PieceType[]>;
  scores: Record<Player, number>;
  current: Player;
  bot: Player;
  board: { width: number; height: number };
  rulesSource: RulesSource; // de RulesView.ts
  pieceConfig: PieceMovementConfigMap; // engine.config (datos planos)
  budget: SearchBudget;
  seed: number;
  personality: Personality;
}
export type HardResponse =
  { id: number; ok: true; result: HardSearchResult } | { id: number; ok: false; error: string };

// ComputerPlayer.ts — extensión
export interface ComputerPlayer {
  // …métodos sync existentes…
  choosePlayActionAsync?(ctx: BotContext, signal: AbortSignal): Promise<BotPlayAction[]>; // secuencia del turno
}
```

### Búsqueda Hard (resumen; detalle en Task 06)

- Negamax **PVS** con iterative deepening; aspiration window ±50 desde la profundidad 3.
- **TT** (Map por hash de 32 bits × 2 o `BigInt` de 64): profundidad, valor, tipo (exacto/cota), mejor acción.
- Orden: jugada de TT → anotaciones → capturas por SEE ≥ 0 (MVV-LVA) → killers (2 por ply) →
  history → bajadas de banca → resto.
- **Quiescence** (máx. 6 plies): solo capturas con SEE ≥ 0, anotaciones y avances de piezas a
  `distToGoal ≤ 1`; stand-pat con la evaluación.
- **Extensión** +1 ply si el rival tiene una pieza a `distToGoal ≤ 1` sin controlar (una vez por rama).
- **Banca:** si el bando que mueve puede bajar, sus acciones incluyen las **3 mejores bajadas**
  (por evaluación estática) como nodos que **no cambian de turno ni gastan profundidad**,
  máximo `benchSize` seguidas; después, movimiento normal.
- **Late move reductions:** reducir 1 ply jugadas tardías (índice ≥ 4, profundidad ≥ 3, sin captura/anotación);
  re-buscar si superan alfa.
- **Tiempo:** chequear el reloj cada 1 024 nodos; al agotarse devolver la última iteración completa.

### Evaluación Hard

`evalHard = evalMedium(weights ajustados) + w.see × SEEbalance + w.race × raceScore`

- **SEE** (static exchange): para cada casilla con pieza atacada, resolver la secuencia de
  capturas/recapturas con los atacantes de cada bando ordenados por valor (usando
  `getCaptureSquares`); suma lo ganable por el bando que mueve.
- **Carrera** (`race.ts`): para cada corredor con carril libre, `turnsToScore = ceil(distToGoal / forwardReach)`;
  `turnsToCatch` = mínimas jugadas de cualquier pieza rival para capturarlo u ocupar su camino
  (BFS acotado sobre `getValidMoves`, profundidad ≤ `turnsToScore + 1`, cacheado por hash).
  Si `turnsToScore < turnsToCatch` (ajustado por quién mueve) → corredor **imparable**:
  `+ 0.8 × pointValue` (casi un punto). Solo se calcula si hay piezas a `≤ runnerZone + 2`.

## Pantallas / Componentes

| Componente                                   | Cambio                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DifficultySelector.tsx`                     | Opción "Hard" + hint                                                                                       |
| `components/PersonalitySelector.tsx` (nuevo) | Ofensivo / Defensivo / Equilibrado; visible solo con Hard                                                  |
| `GameStatusBar.tsx`                          | "Computer is thinking…" mientras hay búsqueda en curso (ya existe el texto; ahora refleja el estado async) |
| `lib/rulesContent.ts`                        | Línea de dificultades con Hard                                                                             |

Sin rutas nuevas.

## Secuencia de Implementación

| #   | Task file                       | Capa                          | Depende de |
| --- | ------------------------------- | ----------------------------- | ---------- |
| 1   | tasks/01-board-index.md         | domain                        | —          |
| 2   | tasks/02-search-board.md        | ai/hard                       | 1          |
| 3   | tasks/03-zobrist-tt.md          | ai/hard                       | 2          |
| 4   | tasks/04-hard-evaluation.md     | ai/hard (+ medium/evaluation) | 2          |
| 5   | tasks/05-personalities.md       | ai/hard                       | 4          |
| 6   | tasks/06-hard-search.md         | ai/hard                       | 3, 4, 5    |
| 7   | tasks/07-worker.md              | ai/hard                       | 6          |
| 8   | tasks/08-async-bot-turn.md      | store + hook                  | —          |
| 9   | tasks/09-hard-setup.md          | ai/hard                       | 5, 6, 7    |
| 10  | tasks/10-weight-tuning.md       | ai/testing (dev)              | 5, 6       |
| 11  | tasks/11-hard-facade-lazy.md    | ai + store                    | 7, 8, 9    |
| 12  | tasks/12-ui-hard.md             | components                    | 11         |
| 13  | tasks/13-tests-arena-tactics.md | tests                         | 5, 10, 11  |
| 14  | tasks/14-final-verification.md  | verificación                  | all        |

Paralelizable: 1 y 8 desde el inicio; 3 en paralelo con 4–5; 10 en paralelo con 7–9.

## Criterios de Aceptación Globales

- [ ] Hard gana ≥ 70 % de 40 partidas sembradas vs Medium y ≥ 90 % vs Easy (modo nodos).
- [ ] Suite táctica profunda verde (combinaciones de 2 jugadas propias, carreras, sacrificio para
      abrir carril, bajada de banca que tapona) + todas las tácticas de Medium.
- [ ] Variantes de reglas: 0 acciones ilegales; Hard ≥ 60 % vs Medium.
- [ ] Personalidades: cada una ≥ 60 % vs Medium y entre 40 % y 60 % vs `balanced`; las métricas de
      estilo muestran diferencias en la dirección esperada (ofensivo avanza/anota antes, defensivo
      concede menos avance y pierde menos piezas).
- [ ] En producción la decisión respeta el presupuesto (≤ 1 000 ms) y la UI no se congela
      (búsqueda en worker); en jsdom/tests usa fallback en hilo con presupuesto de nodos.
- [ ] Si el usuario sale al menú, navega el historial o cambia de modo durante la búsqueda, el
      resultado se descarta (sin acciones fantasma).
- [ ] Chunk principal sin crecimiento atribuible a Hard (± 1 KB gzip); Hard vive en su chunk/worker.
- [ ] `ai/**` sin constantes de reglas ni `PieceType.X` (lint). Con reglas cambiadas y pesos
      desactualizados: Hard juega con pesos por defecto y avisa en dev.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pasan. Cero `any`.

## Preguntas Abiertas / Supuestos

- **Supuesto:** 800 ms de pensamiento + 700 ms del delay actual se sienten bien; ambos son configurables.
- **Supuesto:** la TT es un `Map<string, Entry>` con clave de dos enteros de 32 bits (evita `BigInt`
  por rendimiento); tamaño máx. 200 000 entradas con reemplazo por profundidad.
- **Supuesto:** "Hard" no hace trampa: en HIDDEN no ve el setup rival; en juego la información es completa.
- **Supuesto:** el ajuste de pesos (Task 10) se corre a mano en la máquina del dev (puede tardar
  horas); el resultado se commitea como JSON. CI no lo corre.
- **Abierto:** ¿personalidad "Sorpresa" (elige una al azar y no la muestra hasta el final)? Trivial con
  este diseño; fuera de alcance por ahora.
- **Abierto:** si se quiere un nivel "Expert", la misma infraestructura permite subir el tiempo
  a 3 s — fuera de alcance.
