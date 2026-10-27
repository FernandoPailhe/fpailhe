# lab/universes — plataforma de juegos narrativos por decisiones

Módulo autónomo (mismo patrón que `lab/trymate`): sirve varios "universos"
(juegos de cartas de situación con parámetros en tensión) cargados como JSON
en `content/<slug>/`. El contenido se produce con los skills de `.devin/`;
ver `doc/universes/README.md`.

## Capas

- `domain/` — tipos (`models.ts`, copia del spec), motor puro (`engine/`),
  validación de contenido y puertos de repositorio. No importa React ni
  otras capas (lo garantiza ESLint).
- `application/` — hooks (`useNarrativeGame`, `useUniverses`…), view models,
  store Zustand de la partida, keys de TanStack Query.
- `infrastructure/` — registro de universos (`import.meta.glob`), bundle de
  contenido, `localStorage` (sesión e identidad local).
- `components/` + `routes/` — UI y páginas (`/lab/universes[...]`).
- `theme/` — pipeline `AestheticProfile` → variables CSS `--uv-*`.
- `content/` — universos reales (JSON). `testing/fixtures/` — universo de
  pruebas `demo-reino` (solo dev/tests).

## Extraer a otro repo

Copiar esta carpeta más:

- `apps/web/scripts/universeShells.mjs` y su llamada en `prerender.mjs`
  (shells por universo publicado; el hosting usa `not_found_handling = "404-page"`).
- El bloque de guards `lab/universes` en `eslint.config.js`.
- El script `universes:validate` del `package.json` raíz (y `scripts/validateUniverses.mjs`).

Dependencias runtime: `react`, `react-router-dom`, `zustand`,
`@tanstack/react-query`. El módulo no usa `@ferpa/data-model` ni `@ferpa/ui`
(decisión de diseño: nombres del modelo colisionan; el módulo debe poder
extraerse completo).
