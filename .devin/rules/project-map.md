---
trigger: always
---

# Mapa del proyecto — Ferpa Monorepo

Referencia rápida de archivos clave. Consultá esto antes de buscar dónde
vive algo.

## Estructura

```
ferpa/
├── apps/web/                        ← App web (Vite + React)
│   ├── index.html                   ← HTML entry point
│   ├── tailwind.config.ts           ← Tailwind (consume tokens de @ferpa/ui)
│   ├── vite.config.ts               ← Vite config
│   ├── postcss.config.js            ← PostCSS (Tailwind + Autoprefixer)
│   ├── .env.example                 ← Variables de entorno (VITE_API_BASE_URL)
│   ├── public/data/                 ← JSON estáticos (datos de ejemplo)
│   │   ├── items.json               ← Entidades de ejemplo
│   │   └── meta.json                ← Metadata de la app
│   └── src/
│       ├── main.tsx                 ← Entry: providers (Theme, Query, Router)
│       ├── App.tsx                  ← Rutas de la app
│       ├── routes/                  ← Páginas (1 archivo = 1 ruta)
│       │   ├── HomePage.tsx
│       │   └── NotFoundPage.tsx
│       ├── components/              ← Organismos (conocen el dominio)
│       │   ├── LoadingState.tsx
│       │   └── ErrorState.tsx
│       ├── services/                ← Capa de transporte (Axios)
│       │   ├── httpClient.ts        ← Cliente HTTP con baseURL configurable
│       │   └── dataService.ts       ← Fetchers tipados
│       ├── queries/                 ← TanStack Query hooks
│       │   ├── keys.ts              ← Query keys centralizadas
│       │   └── useItemsQuery.ts
│       ├── domain/                  ← Hooks de lógica derivada (useMemo)
│       ├── store/                   ← Zustand stores (UI efímera)
│       ├── layout/                  ← Layout wrappers con <Outlet />
│       ├── lab/trymate/             ← Módulo independiente del juego TryMate (ver sección abajo)
│       ├── lib/                     ← Utilidades de infra
│       │   └── queryClient.ts       ← QueryClient singleton
│       └── styles/
│           └── globals.css          ← CSS base (Tailwind layers)
│
├── packages/data-model/             ← Dominio puro (sin React)
│   └── src/
│       ├── index.ts                 ← Barrel export
│       ├── types.ts                 ← Interfaces del dominio
│       ├── domain.ts                ← Funciones puras de cálculo
│       └── format.ts                ← Formatters puros
│
├── packages/ui/                     ← Design system (sin dominio)
│   └── src/
│       ├── index.ts                 ← Barrel (theme + atoms + molecules)
│       ├── theme/
│       │   ├── tokens.ts            ← 🎨 FUENTE ÚNICA de colores/fonts/radios
│       │   ├── cssVariables.ts      ← Genera CSS vars desde tokens
│       │   ├── tokenExports.ts      ← Subpath para tailwind.config.ts
│       │   ├── ThemeProvider.tsx     ← Aplica tokens como CSS vars en :root
│       │   └── index.ts
│       ├── atoms/                   ← Badge, Button, SealMark, etc.
│       │   └── index.ts
│       └── molecules/               ← Dialog, TeamIdentity, ComunicadoBox
│           └── index.ts
│
├── package.json                     ← Scripts raíz: dev, build, typecheck
├── pnpm-workspace.yaml              ← Workspace: apps/*, packages/*
├── tsconfig.base.json               ← TS config compartida (strict + noUncheckedIndexedAccess)
└── wrangler.toml                    ← Deploy a Cloudflare Workers
```

## Módulo `apps/web/src/lab/trymate/` (ruta `/lab/trymate`)

Módulo autocontenido: su dominio, estado y componentes viven en esta carpeta (no usa
`packages/data-model`). ✅ = existe · 🗓 = planificado (ver `doc/detailed-plan/`).

```
lab/trymate/
├── TryMatePage.tsx                  ← Página: menú (online / local / vs computer), tablero, sidebar
├── index.ts                         ← Barrel (TryMatePage)
├── domain/                          ← Sin React ni store
│   ├── constants/                   ← ✅ GameConstants (tablero), GameRules (cantidades, PLACEMENT_DEPTH,
│   │                                   filas derivadas), PieceConstants (PieceType, Player, PIECE_MOVEMENT_CONFIG)
│   ├── config/                      ← ✅ RulesView (CURRENT_RULES, rulesFingerprint), QuickStartLayout + JSON
│   ├── rules/                       ← ✅ composition (feasibleTypes), randomArmy (generateRandomArmy)
│   ├── entities/                    ← ✅ Board, GamePiece, Position, Tile, PlayerState, MoveHistory, GameSnapshot
│   └── interfaces/                  ← ✅ IGameState, IMovementRule, RoomsGateway
├── application/
│   ├── GameState.ts                 ← ✅ Store Zustand (juego + vs computer: runBotTurn, botController)
│   ├── RoomState.ts, roomSync.ts    ← ✅ Salas online (Firebase)
│   ├── useComputerTurn.ts           ← ✅ Hook que agenda el turno del bot
│   ├── rules/                       ← ✅ MovementRuleEngine (config inyectable, getCaptureSquares), turnRules
│   └── ai/                          ← Bots: puros y agnósticos de reglas (lint)
│       ├── ComputerPlayer.ts        ← ✅ BotContext, ComputerPlayer, registro por dificultad
│       ├── EasyBot.ts, rng.ts       ← ✅ Bot Easy, rng sembrado
│       ├── sim/SimState.ts          ← ✅ Simulación inmutable con reglas inyectadas
│       ├── arena.ts                 ← ✅ Árbitro bot-vs-bot (solo tests / selfplay)
│       ├── testing/ruleVariants.ts  ← ✅ Variantes de reglas para tests
│       ├── introspection/, analysis/, medium/, MediumBot.ts   ← 🗓 Medium
│       └── hard/, personality.ts    ← 🗓 Hard (worker, chunk lazy) + personalidades
├── selfplay/                        ← 🗓 Auto-juego y estadísticas (NO entra al bundle web)
│   ├── core/                        ← TS puro: formato de partidas, grabador, experimentos, agregación, reportes
│   ├── node/                        ← CLI + worker_threads + I/O (build SSR a apps/web/.selfplay-dist/)
│   ├── experiments/                 ← Presets JSON (smoke, balance-*, rules-*, personalities-matrix)
│   └── duckdb/                      ← Consultas SQL opcionales
├── infrastructure/                  ← ✅ Firebase / InMemory RoomsGateway
├── components/                      ← ✅ Organismos del juego (tablero, diálogos, sidebar, lobby, reglas)
└── lib/                             ← ✅ gameDisplay, rulesContent (textos generados desde CURRENT_RULES), useBoardSize
```

Skills: `trymate-rules-agnostic` (reglas y motor), `trymate-computer-player` (bots),
`trymate-selfplay` (auto-juego), `rugby-chess-state` / `rugby-chess-domain` / `rugby-chess-code-review`
(store, dominio y revisión del módulo). Planes: `doc/detailed-plan/trymate-*`.
Datos de selfplay: fuera del repo (`~/TryMateData/selfplay/` o `TRYMATE_DATA_DIR`).

## Scopes de paquetes

| Package | Scope | Directorio |
|---|---|---|
| App web | `@ferpa/web` | `apps/web` |
| Design system | `@ferpa/ui` | `packages/ui` |
| Data model | `@ferpa/data-model` | `packages/data-model` |

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Build packages + Vite dev server |
| `pnpm build` | Build producción (data-model → ui → web) |
| `pnpm typecheck` | TypeScript check en los 3 paquetes |
| `pnpm preview` | Serve del build de producción |
| `pnpm lint` / `pnpm test` | ESLint (incluye guardas de agnosticismo en `lab/trymate/application/ai/**`) / Vitest |
| `pnpm trymate:selfplay --config <preset>` | 🗓 Auto-juego bot-vs-bot (ver skill `trymate-selfplay`) |
| `pnpm trymate:report <batch>` / `trymate:compare <A> <B>` / `trymate:validate <batch>` | 🗓 Reporte, comparación y validación de batches |
