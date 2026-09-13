# Task 07: Configurar ESLint, Prettier, .editorconfig y scripts

> Parte del plan: `../plan.md` — leerlo para contexto de calidad y comandos globales.

## Skill / Capa

Infraestructura de tooling en la raíz del monorepo. Modifica `package.json` raíz, configura ESLint flat config, Prettier y .editorconfig.

## Objetivo

Agregar los cuatro controles de calidad automatizados que hoy faltan: lint, format, test y typecheck, todos ejecutables desde `pnpm` en la raíz. Esto cierra la contradicción entre el CV ("introduced 4 automated quality gates") y el repo.

## Depende De

— (ninguno; este task es base para Tasks 08, 09, 16).

## Archivos a Crear/Editar

- `package.json` (raíz) — editar scripts y devDependencies
- `eslint.config.js` (raíz) — crear
- `.prettierrc` (raíz) — crear
- `.prettierignore` (raíz) — crear
- `.editorconfig` (raíz) — crear

## Detalles de Implementación

### 1. Dependencias en `package.json` raíz

Agregar a `devDependencies` (versiones mínimas publicadas hace más de 7 días; ajustar patch/minor según disponibilidad):

```json
{
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "eslint": "^9.20.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.18",
    "globals": "^15.14.0",
    "prettier": "^3.5.0",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.24.0"
  }
}
```

**NO usar** versiones flotantes tipo `latest` ni `*`. Verificar con `pnpm info <pkg>` que la versión resuelta no sea de los últimos 7 días.

### 2. Scripts en `package.json` raíz

Reemplazar/actualizar `scripts` para incluir:

```json
{
  "scripts": {
    "dev": "pnpm --filter @ferpa/data-model build && pnpm --filter @ferpa/ui build && pnpm --filter @ferpa/web dev",
    "build": "pnpm --filter @ferpa/data-model build && pnpm --filter @ferpa/ui build && pnpm --filter @ferpa/web build",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "pnpm --filter @ferpa/web preview"
  }
}
```

- `test` se implementa en Task 09 (Vitest); aquí se reserva el script.
- `lint` y `format` corren desde la raíz sobre todo el monorepo.

### 3. `eslint.config.js`

Configuración flat para TypeScript + React + React Hooks + React Refresh.

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
```

Ajustar `ignores` si hay otras carpetas generadas. No apagar `no-explicit-any` ni `noUncheckedIndexedAccess` (la última vive en `tsconfig.base.json`).

### 4. `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

El repo usa comillas dobles y 2 espacios. Alinearse con el estilo existente.

### 5. `.prettierignore`

```
dist
node_modules
pnpm-lock.yaml
*.iml
```

### 6. `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

## Fuera de Alcance

- No instalar Vitest aquí; es Task 09.
- No crear el workflow de CI; es Task 08.
- No corregir errores de lint existentes en el repo si los hay; hacerlo en Task 16 si es menor, o consultar si son muchos.

## Verificación

- [ ] `pnpm install` resuelve sin advertencias de peer incompatibles.
- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm lint` corre sin errores de configuración (puede reportar problemas de estilo existentes; esos se corrigen con `pnpm lint:fix` o manualmente).
- [ ] `pnpm format:check` pasa (o `pnpm format` formatea sin cambios tras un commit).
- [ ] `pnpm build` pasa.
- [ ] `pnpm test` responde con el setup de Vitest (aunque aún no haya tests, Task 09).

## Handoff

- Produce: tooling de calidad configurado y scripts raíz listos.
- Próximos tasks: Task 08 (CI), Task 09 (tests), Task 16 (limpieza de estilo/template).
