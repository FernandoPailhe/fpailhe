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
