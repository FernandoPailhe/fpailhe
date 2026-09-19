# Spec: Módulo `lab/rugby-chess`

## Objetivo

Módulo experimental **independiente** accesible desde la ruta `/lab/rugby-chess`. Es un "lab": no forma parte del contenido del portfolio y no debe acoplar el resto del sitio.

## Ubicación

```
apps/web/src/lab/rugby-chess/
├── RugbyChessPage.tsx        # página de la ruta (equivalente a routes/*.tsx)
├── components/               # componentes específicos del módulo
│   └── RugbyChessBoard.tsx
├── domain/                   # lógica pura del juego (sin React, sin fetch)
│   ├── types.ts              # tipos internos del módulo
│   └── engine.ts             # estado inicial, reglas, movimientos
└── index.ts                  # barrel export (named exports)
```

## Ruta

Registrada en `apps/web/src/App.tsx`:

```tsx
<Route path="lab/rugby-chess" element={<RugbyChessPage />} />
```

## Decisiones de arquitectura

- **Módulo autocontenido**: su dominio (`domain/`) y componentes (`components/`) viven dentro de la carpeta del módulo, no en `src/domain` ni `src/components` globales.
- **Tipos internos**: los tipos del juego (`Piece`, `BoardState`, etc.) se declaran en `domain/types.ts`. Solo se promueven a `packages/data-model/src/types.ts` si se vuelven reutilizables fuera del módulo.
- **Sin capa de datos**: el scaffold no consume JSON ni fetch. Si en el futuro necesita datos estáticos, seguir el patrón del repo: JSON en `apps/web/public/data/` → fetcher en `services/dataService.ts` → hook en `queries/` → key en `queries/keys.ts` → domain → componentes.
- **`packages/ui`**: solo para componentes genéricos reutilizables (atoms/molecules). Todo lo específico de rugby-chess queda en el módulo.
- **Navegación**: la ruta es accesible directamente pero no está en `NAV_LINKS` de `HomePage` (experimental/oculta). Para hacerla navegable, agregar `{ label: "Lab", href: "/lab/rugby-chess" }`.

## Assets

Los assets estáticos del módulo van en `apps/web/public/lab/rugby-chess/` (subcarpeta por feature, como `project-media/`):

```
apps/web/public/lab/rugby-chess/
├── pieces/          # sprites/SVG de piezas
├── board/           # texturas o fondos del tablero
└── README.md        # checklist de assets esperados (convención del repo)
```

Se referencian con paths absolutos desde la raíz: `/lab/rugby-chess/pieces/forward-home.svg`. Imágenes optimizadas (WebP/JPG/PNG, max ~1600px). No usar imports de assets desde `src/`.

## Convenciones aplicadas

- Named exports en todo; nunca `export default`.
- Sin `fetch` en componentes.
- Sin hex/fonts hardcodeados: se usan tokens de tema (`text-ink`, `bg-surface`, `border-line`, `font-ui`, `font-display`, `text-gold-bright`).
- Textos de UI en inglés (el sitio es íntegramente en inglés).

## Estado actual (scaffold)

- `domain/engine.ts`: `createInitialBoard()` genera un tablero 8×8 con una fila de piezas `forward` por lado; `getPieceAt()` resuelve la pieza en una casilla. Las reglas reales del juego están pendientes de definición.
- `components/RugbyChessBoard.tsx`: render placeholder del tablero con `role="grid"`.
- `RugbyChessPage.tsx`: página con `Nav` (links Home/CV), header "Lab / Rugby Chess" y el tablero.

## Pendientes

- Definir reglas del juego (movimientos, capturas, try/goal).
- Estado interactivo (selección de pieza, movimientos válidos, turno).
- Tests del engine con vitest (`apps/web/src/test/` o junto al módulo).
- Decidir si se agrega al nav o queda como ruta oculta.
