# Rugby Chess — Guía de Portabilidad (Kit de Re-implementación)

> **Propósito:** este documento es el manifiesto del paquete de portabilidad de
> Rugby Chess hacia un **nuevo proyecto TypeScript + Vite** que construirá su
> UX/UI desde cero. Lista exactamente qué archivos se copian, qué hay que
> recortar, qué contratos no obvios debe respetar la nueva capa de
> presentación, qué configuración llevar y qué skills/documentos acompañan.
>
> **Documento compañero obligatorio:** [`rules_spec.md`](./rules_spec.md) —
> la especificación completa de reglas. Ante cualquier duda entre código y
> spec, el código manda; ante cualquier duda de diseño, la spec explica el
> porqué.

---

## 1. Lo que se lleva: el núcleo portable

Todo el núcleo del juego depende de **una sola dependencia npm: `zustand`**.
El resto es TypeScript puro — sin DOM, sin Three.js, sin APIs de browser.

### 1.1 Copiar tal cual (cero modificaciones)

| Origen                                        | Destino sugerido                              | Rol                                                                                              |
| --------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/domain/constants/GameRules.ts`           | `src/domain/constants/GameRules.ts`           | Todas las reglas como datos (tamaño ejército, filas, puntos, enums de fase/modo)                 |
| `src/domain/constants/PieceConstants.ts`      | `src/domain/constants/PieceConstants.ts`      | `PieceType`, `Player`, vectores, `PIECE_MOVEMENT_CONFIG` (+ `PIECE_VISUAL_CONFIG`, opcional)     |
| `src/domain/entities/Board.ts`                | `src/domain/entities/Board.ts`                | Grilla + gestión de piezas                                                                       |
| `src/domain/entities/GamePiece.ts`            | `src/domain/entities/GamePiece.ts`            | Pieza: id, tipo, dueño, posición, multiplicador de dirección                                     |
| `src/domain/entities/Position.ts`             | `src/domain/entities/Position.ts`             | Value object de coordenadas                                                                      |
| `src/domain/entities/Tile.ts`                 | `src/domain/entities/Tile.ts`                 | Casilla + estados (ver §4.3)                                                                     |
| `src/domain/entities/PlayerState.ts`          | `src/domain/entities/PlayerState.ts`          | Contadores por jugador + banca + puntaje                                                         |
| `src/domain/entities/MoveHistory.ts`          | `src/domain/entities/MoveHistory.ts`          | Historial con snapshots (navegación atrás/adelante)                                              |
| `src/domain/interfaces/IMovementRule.ts`      | `src/domain/interfaces/IMovementRule.ts`      | Contrato del motor de movimiento                                                                 |
| `src/domain/interfaces/IGameState.ts`         | `src/domain/interfaces/IGameState.ts`         | Contrato mínimo que la UI consume                                                                |
| `src/application/rules/MovementRuleEngine.ts` | `src/application/rules/MovementRuleEngine.ts` | **Motor de reglas completo**: movimientos legales, bloqueados, bloqueo Bulwark, L-shape del Apex |

**Total sección 1.1: 11 archivos, dependencias externas: ninguna.**

### 1.2 Copiar con decisión previa

| Origen                                  | Decisión           | Detalle                                                                                                                                                 |
| --------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/application/GameState.ts`          | ⚠️ Ya recortado    | Store Zustand + orquestación de fases. **Se entrega sin IA** (ver §3).                                                                                  |
| `src/application/ai/`                   | ❌ **No incluida** | La IA histórica fue descartada (nunca funcionó bien). Su re-implementación es un trabajo de **Fase 2** — contrato planificado en `rules_spec.md` §12.2. |
| `src/domain/constants/GameConstants.ts` | ⚠️ Recortar        | Solo `BOARD_WIDTH/HEIGHT/TILE_SIZE` son de reglas. `CAMERA`, `LIGHTING`, `COLORS` son de la vista 3D vieja — borrar o ignorar.                          |
| `src/domain/interfaces/IRenderer.ts`    | ⚠️ Opcional        | Referencia `HTMLElement`. Sirve como contrato si la nueva UX es web/DOM; si es otra plataforma, redefinir el puerto.                                    |

### 1.3 NO copiar (se reescribe = la nueva UX/UI)

```
src/infrastructure/rendering/   # ThreeJSRenderer, Board3D, Tile3D, Piece3D
src/presentation/               # GameController, PieceButton(Manager), tutorial/*
src/main.ts, src/tutorial_main.ts, index.html, tutorial.html
```

Estos archivos quedan como **referencia de comportamiento**, no como base de
código. El nuevo proyecto implementa su propio renderer + UI contra los
contratos de §4.

---

## 2. Configuración del proyecto nuevo

### 2.1 `package.json` — dependencias

```jsonc
{
  "dependencies": {
    "zustand": "^4.4.7", // única dependencia runtime del núcleo
    // "three": "^0.160.0"     // SOLO si la nueva UX también es Three.js
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    // "@types/three": "^0.160.0"  // solo con three
  },
}
```

### 2.2 `tsconfig.json` — copiar tal cual del proyecto original

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
  },
  "include": ["src"],
}
```

> ⚠️ `noUnusedLocals` + `noUnusedParameters` están activos: el código portado
> compila limpio hoy (ya verificado con el recorte de IA aplicado), pero
> cualquier modificación posterior debe dejar imports consistentes o `tsc`
> fallará.

### 2.3 `vite.config.ts` — versión mínima

```ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { host: true, port: 3000 },
});
```

(Solo agregar `manualChunks: { three: ['three'] }` si se usa Three.js.)

---

## 3. La IA no viaja — queda para la Fase 2

El paquete se entrega **sin IA**: la implementación histórica fue descartada y
`GameState.ts` ya viene recortado (compila limpio con `tsc --noEmit`).
Lo que se eliminó respecto al original:

| Elemento eliminado                                       | Detalle                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/application/ai/` (9 archivos)                       | AIPlayer, MinimaxEngine, evaluadores, personalidades, oponentes, aprendizaje adaptativo |
| `import { AIPlayer }` + `import { Difficulty }`          | imports del store                                                                       |
| Campos `aiPlayer`, `isAIThinking`                        | de la interfaz y el estado inicial                                                      |
| `isAITurn()`, `executeAITurn()`                          | acciones completas (~120 líneas)                                                        |
| Bloque de creación de IA en `setGameMode()`              | reducido a un setter trivial                                                            |
| Timeouts de IA en `goForwardInHistory`/`returnToPresent` | navegación de historial sin disparos automáticos                                        |
| `GameMode.PVC_{EASY,MEDIUM,HARD}`                        | enum reducido a `PVP`                                                                   |

**Fase 2 — re-introducir el jugador automático:**

- El contrato de puerto planificado (`IPlayerAgent`) está especificado en
  `rules_spec.md` §12.2: basta implementar `selectMove` / `selectSetupPiece` /
  `selectBenchPiece` y orquestar sus llamadas desde la sesión.
- Los valores `PVC_*` de `GameMode` y el enum `Difficulty` se reintroducen en
  `GameRules.ts` junto con el agente.
- La implementación histórica queda disponible en el repo original como
  referencia (no como base — era frágil); conviene reescribirla.
- Ver también `rules_spec.md` §13.1 caso 7: la Fase 2 probablemente requiera
  una acción `pass` para que el agente (y los humanos) puedan ceder el turno.

---

## 4. Contratos no obvios que la nueva UX/UI debe implementar

Estos son los detalles que **no** se deducen de leer el store — hoy viven
repartidos entre `GameController.ts` y el store. La nueva capa de input debe
replicarlos (o mejor, encapsularlos en el orquestador).

### 4.1 El store no ejecuta movimientos al click

`selectTile` solo **selecciona / reselecciona / deselecciona**. El movimiento
lo dispara el controller:

```ts
function onTileClick(position: Position): void {
  const state = useGameStore.getState();
  const clickedPiece = state.board.getPieceAt(position);

  // 1. PRIORIDAD: colocación de banca (acción gratuita)
  if (state.gamePhase === GamePhase.PLAYING && state.canPlaceBenchPiece() && !clickedPiece) {
    state.placeBenchPiece(position);
    return;
  }

  // 2. Movimiento confirmado: hay pieza seleccionada y el destino es legal
  if (state.selectedPiece && state.validMoves.some((p) => p.equals(position))) {
    state.movePiece(position);
    return;
  }

  // 3. Resto: selección / reselección / deselección / colocación en SETUP
  state.selectTile(position);
}
```

> **Recomendación para el nuevo proyecto:** encapsular esta lógica como una
> única acción `handleTileClick(position)` dentro del orquestador, en lugar de
> heredar la división store↔controller actual. Es el principal punto donde el
> diseño viejo dispersa una regla de interacción.

### 4.2 Semántica de selección (en PLAYING)

- Click en pieza propia → selecciona + calcula `validMoves` y `blockedMoves`
  (estos últimos son destinos "alcanzables por patrón pero ilegales" — útiles
  para mostrar en UI el efecto del bloqueo del Bulwark).
- Click en otra pieza propia → cambia la selección.
- Click en destino legal → movimiento (vía controller, ver 4.1).
- Click en cualquier otra casilla → deselecciona.
- Click en casilla vacía válida con banca disponible → **coloca banca**
  (tiene prioridad sobre deseleccionar).

### 4.3 Estados visuales de `Tile`

`Tile` arrastra `TileState` (`EMPTY`, `OCCUPIED`, `SELECTED`, `HIGHLIGHTED`)
que el motor/estado mantiene actualizados. La nueva UI puede:

- **Usarlos**: leer `tile.getState()` para pintar selección/resaltado, o
- **Ignorarlos**: derivar el highlighting de `selectedPiece`/`validMoves`/
  `blockedMoves` del store (más limpio para una UX nueva — los `TileState`
  quedan como mecanismo interno redundante pero inofensivo).

### 4.4 `quickStart()` — tu mejor amigo en desarrollo

El store incluye `quickStart()`: inicializa una partida completa con layout
predefinido y pasa directo a `PLAYING`. Ideal para iterar la UI sin recorrer
SETUP y BENCH_SELECTION en cada reload.

### 4.5 Suscripción a cambios

El `GameState` (clase wrapper) expone `subscribe(callback)` → la UI se
re-suscribe y re-renderiza. Alternativa directa: `useGameStore.subscribe(...)`.
En un framework reactivo (React/Vue/Svelte), envolver el store con su adapter
correspondiente o usarlo directamente (Zustand funciona standalone).

### 4.6 Historial = solo lectura

`goBackInHistory`/`goForwardInHistory`/`returnToPresent` reemplazan el `board`
por snapshots. Mientras `isViewingHistory === true`, la UI debe **bloquear
interacción de juego** (el store no lo impide por sí solo — hacer un movimiento
en el pasado mutaría un tablero histórico y truncaría el futuro del historial).

---

## 5. Mapa completo de archivos

```
PROYECTO NUEVO
├── package.json            ← §2.1
├── tsconfig.json           ← §2.2 (copiar del original)
├── vite.config.ts          ← §2.3
├── index.html              ← NUEVO (UX propia)
├── rules_spec.md           ← COPIAR (fuente de verdad de reglas)
└── src/
    ├── domain/             ← §1.1: copiar 11 archivos tal cual
    │   ├── constants/
    │   │   ├── GameConstants.ts    ← recortado (§1.2)
    │   │   ├── GameRules.ts
    │   │   └── PieceConstants.ts
    │   ├── entities/       (6 archivos)
    │   └── interfaces/     (2-3 archivos)
    ├── application/
    │   ├── GameState.ts    ← §3 (ya recortado, sin IA)
    │   └── rules/
    │       └── MovementRuleEngine.ts
    │                         (ai/ NO viaja — extensión de Fase 2, §3)
    ├── ui/                 ← NUEVO: tu UX
    └── main.ts             ← NUEVO: bootstrap
```

---

## 6. Skills transferibles

Los skills viven en `.windsurf/skills/<nombre>/SKILL.md` (un archivo por
skill — se copian como archivos sueltos). Para Devin el destino equivalente
es `.devin/skills/`; para Windsurf, `.windsurf/skills/` en el proyecto nuevo.

| Skill                                  | ¿Pasar?                            | Motivo                                                                                                                                 |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `rugby-chess-domain`                   | ✅ **Sí**                          | Documenta convenciones del dominio (config-over-code, entidades, interfaces). Sigue aplicando verbatim si se respeta `src/domain/`.    |
| `rugby-chess-state`                    | ✅ **Sí**                          | Documenta el store Zustand y el MovementRuleEngine — el núcleo portado. Ya viene limpio de referencias a IA.                           |
| `rugby-chess-ai`                       | ❌ **No (Fase 2)**                 | El skill queda en el repo original; recuperarlo cuando se implemente el agente (rules_spec §12.2).                                     |
| `rugby-chess-code-review`              | ✅ **Sí**                          | Checklist de calidad por capa (violaciones de dependencias, strictness, patrones). Agnóstico de la UI.                                 |
| `rugby-chess-feature`                  | ⚠️ Opcional                        | Orquestación de features multi-capa; útil como metodología aunque referencia skills de renderer/presentation que quizá no apliquen.    |
| `rugby-chess-dev-orchestrator`         | ⚠️ Opcional                        | Meta-skill de sesiones; solo tiene sentido si se portan también los skills de capa que coordina.                                       |
| `rugby-chess-presentation`             | ⚠️ Opcional                        | Describe la UI vieja (GameController, tutorial) que NO se porta. Útil solo por sus reglas de frontera ("nunca DOM desde application"). |
| `rugby-chess-3d-renderer`              | ❌ Solo si la nueva UX es Three.js | 100% específico del renderer viejo.                                                                                                    |
| `real-time-multiplayer-3d-development` | ❌ No                              | Stub vacío (6 líneas, sin contenido).                                                                                                  |

**Nota:** los skills referencian rutas `src/domain/`, `src/application/`… —
si el nuevo proyecto mantiene esa estructura (recomendado, §5), los skills
funcionan sin edición. Si se renombran capas, habrá que ajustar las rutas en
los frontmatter/scopes.

---

## 7. Orden de trabajo sugerido para la implementación

1. **Bootstrap**: `npm create vite@latest` (vanilla-ts o el framework elegido)
   → instalar `zustand` → copiar `tsconfig.json` + `vite.config.ts` mínimo.
2. **Núcleo**: copiar §1.1 → `npx tsc --noEmit` debe compilar limpio.
3. **Estado**: copiar `GameState.ts` (ya viene sin IA) → compilar.
4. **Smoke test sin UI**: desde `main.ts`, ejecutar `quickStart()` y jugar por
   consola (`selectTile` + `movePiece`) — el juego es funcional sin renderer.
5. **UI mínima**: suscripción al store + grid que pinte `board.getAllPieces()`
   - `handleTileClick` según §4.1.
6. **Iterar UX**: fases, banca, marcador, historial, modos — siguiendo
   `rules_spec.md` §8–10 como checklist.

---

## 8. Checklist del paquete a entregar

- [ ] `rules_spec.md` — especificación de reglas
- [ ] `PORTING_GUIDE.md` — este documento
- [ ] `src/domain/` — 12-13 archivos (incl. `GameConstants` recortado)
- [ ] `src/application/rules/MovementRuleEngine.ts`
- [ ] `src/application/GameState.ts` — _ya recortado, sin IA (§3)_
- [ ] `tsconfig.json`
- [ ] Skills seleccionados (§6) → `.devin/skills/` o `.windsurf/skills/`
- [ ] `package.json` como referencia de dependencias (no copiar scripts)

_Generado a partir del análisis del grafo de dependencias real del proyecto.
El núcleo portable compila con `npx tsc --noEmit` sin errores y solo requiere
`zustand` como dependencia runtime._
