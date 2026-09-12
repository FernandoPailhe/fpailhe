# Ferpa — Monorepo Template

Monorepo template con **pnpm workspaces** + Vite + React 18 + TypeScript
estricto + TanStack Query + Zustand + TailwindCSS.

```
ferpa/
├── apps/
│   └── web/              # App web (Vite + React)
├── packages/
│   ├── data-model/       # Tipos, lógica de dominio y formateo (sin React)
│   └── ui/               # Design system: theme + átomos + moléculas
├── package.json          # Scripts raíz (dev, build, typecheck)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Paquetes

| Paquete | Scope | Rol |
|---|---|---|
| `apps/web` | `@ferpa/web` | Composición: rutas, servicios, queries, componentes de página |
| `packages/ui` | `@ferpa/ui` | Presentación pura: `ThemeProvider`, atoms, molecules |
| `packages/data-model` | `@ferpa/data-model` | Dominio puro: tipos TS, funciones de cálculo, formatters |

## Cómo levantar

```bash
pnpm install
pnpm dev     # build de packages + Vite en http://localhost:5173
```

Producción:

```bash
pnpm build
pnpm preview
```

## Datos

Los datos de ejemplo viven en `apps/web/public/data/`:

- `items.json` → entidades de ejemplo
- `meta.json` → metadata de la app

La app los lee vía `services/dataService.ts` usando Axios. Para conectar un
backend real, cambiar `VITE_API_BASE_URL` en `.env`.

## Theming

Un solo archivo gobierna el look:
**`packages/ui/src/theme/tokens.ts`** (colores, tipografías, radios).

- `ThemeProvider` vuelca los tokens como variables CSS en `:root`.
- `tailwind.config.ts` genera las clases de utilidad a partir del mismo
  objeto, vía `@ferpa/ui/theme-tokens`.

Para cambiar colores, tipografías o radios: editar `tokens.ts` y nada más.

## Estado

| Tipo | Dónde vive |
|---|---|
| Servidor (datos remotos) | TanStack Query (`queries/`) |
| Derivado (cálculos) | `useMemo` en hooks de `domain/` |
| Navegación | URL (React Router) |
| UI efímero | Zustand (`store/`) |

## Componentes atómicos

- **Atoms** (`packages/ui/src/atoms/`): Badge, Button, CheckerRule, DnfTag,
  PositionChip, PtsValue, SealMark, StatPill
- **Molecules** (`packages/ui/src/molecules/`): ComunicadoBox, Dialog,
  TeamIdentity

`Dialog` está escrito a mano (sin Radix/shadcn) con foco atrapado, cierre
con Escape/clic afuera y devolución de foco.

## Estilos

- TailwindCSS con theme extendido desde tokens
- Breakpoint custom: `mobile` (max-width: 680px)
- Sin CSS Modules — solo Tailwind utilities

## Deploy

Configurado para Cloudflare Workers (ver `wrangler.toml`). Editar las
rutas/dominio antes de deployar.
