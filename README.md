# Fernando Pailhe — Personal Site

Personal site and CV of Fernando Pailhe, Mobile Engineer — React Native
and Kotlin, from first commits to rescued codebases. Live at
[fpailhe.com](https://fpailhe.com).

## Stack

pnpm monorepo + Vite + React 18 + TypeScript (strict) + TanStack Query +
Zustand + TailwindCSS. Static content lives in JSON files; a post-build
script prerenders `/` and `/cv` to real HTML so the site reads fine
without JavaScript.

```
fpailhe/
├── apps/
│   └── web/                # Web app (Vite + React)
│       ├── public/data/    # Content JSON (profile, experience, projects…)
│       ├── scripts/        # prerender.mjs (static HTML for / and /cv)
│       └── src/
│           ├── components/ # Page-level organisms
│           ├── queries/    # TanStack Query hooks
│           ├── domain/     # Derived-state hooks (useMemo over pure fns)
│           ├── services/   # dataService + httpClient (fetchers)
│           └── routes/     # / , /cv, 404
├── packages/
│   ├── data-model/         # @ferpa/data-model — types + pure domain logic
│   └── ui/                 # @ferpa/ui — theme tokens, atoms, molecules
├── wrangler.toml           # Cloudflare Workers static assets deploy
└── vitest.config.ts        # Vitest projects (data-model + web)
```

## Getting started

```bash
pnpm install
pnpm dev       # builds packages, then Vite on http://localhost:5173
pnpm build     # typecheck + vite build + prerender → apps/web/dist
pnpm preview   # serves apps/web/dist
```

## Quality gates

```bash
pnpm typecheck     # builds packages, then tsc --noEmit on all projects
pnpm lint          # ESLint flat config (typescript-eslint + react-hooks)
pnpm format        # Prettier write
pnpm format:check  # Prettier check (CI)
pnpm test          # Vitest: domain unit tests + component tests
```

All gates run in CI (`.github/workflows/ci.yml`) on pushes and PRs to
`main` / `v0.2.0`.

## Content & data flow

Content lives in `apps/web/public/data/*.json` and is typed by
`@ferpa/data-model` (`Job`, `Project`, `Profile`, `Hero`, …). The app
fetches it through `services/dataService.ts` (axios, base URL
`VITE_API_BASE_URL`, default `/data`). To point at a real backend later,
change that env var — nothing else in the app depends on it.

## Theming & dark mode

Single source of truth: `packages/ui/src/theme/tokens.ts` (colors, fonts,
radii) + `darkTokens.ts` for the dark theme. `ThemeProvider` writes the
tokens as CSS variables on `:root` and persists the choice in
`localStorage` (`light` / `dark` / `system`, following
`prefers-color-scheme`). Tailwind classes map to the same variables via
`@ferpa/ui/theme-tokens`, so no hex value is hardcoded outside tokens.

## Deploy

Configured for Cloudflare Workers static assets (`wrangler.toml`,
`name = "ferpa"`):

- `not_found_handling = "404-page"` — missing assets return a real 404
  (`public/404.html`); `/` and `/cv` are real files thanks to prerender.
- `public/_headers` — HSTS, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy, immutable cache for hashed `/assets/*`.
- `public/robots.txt` + `public/sitemap.xml` point to `fpailhe.com`.
- The `www.fpailhe.com` → `fpailhe.com` redirect is configured in
  Cloudflare (Redirect Rules), not in code.

Expected image assets live in `apps/web/public/` — see
`apps/web/public/assets/README.md` for the checklist. Missing project
links are tracked in `doc/project-links.md`.

---

© Fernando Pailhe. All rights reserved.
