# Task 08: Configurar GitHub Actions workflow

> Parte del plan: `../plan.md` — leerlo para contexto de calidad y comandos.

## Skill / Capa

CI/CD: crear workflow de GitHub Actions.

## Objetivo

Ejecutar `typecheck`, `lint` y `test` en cada push y pull request.

## Depende De

- Task 07: los scripts `typecheck`, `lint` y `test` deben existir y funcionar.
- Task 09: `pnpm test` debe estar configurado (aunque el workflow pueda crearse antes, sin tests correrá vacío). Para evitar fallos, asegurar que este task se ejecuta después del 09 o que el workflow no falle con cero tests.

## Archivos a Crear/Editar

- `.github/workflows/ci.yml` — crear

## Detalles de Implementación

Crear `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, v0.2.0]
  pull_request:
    branches: [main, v0.2.0]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.28.0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

Notas:

- `branches`: ajustar si el branch de release se llama diferente. El plan usa `v0.2.0` como contexto.
- `pnpm/action-setup@v4` y `actions/setup-node@v4` son versiones estables.
- `--frozen-lockfile` fuerza a que el `pnpm-lock.yaml` esté actualizado.

## Fuera de Alcance

- No configurar deploy automático en este workflow (puede añadirse más adelante).
- No generar `pnpm-lock.yaml`; se asume que existe o se crea con `pnpm install`.

## Verificación

- [ ] El archivo `.github/workflows/ci.yml` existe y tiene sintaxis válida (validar con `actionlint` si está disponible, o con la vista de GitHub).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build` pasan localmente antes de pushear.
- [ ] Al hacer push a `main` o PR, el workflow corre y todos los jobs terminan verdes.

## Handoff

- Produce: pipeline de CI que bloquea merge si falla typecheck, lint, tests o build.
