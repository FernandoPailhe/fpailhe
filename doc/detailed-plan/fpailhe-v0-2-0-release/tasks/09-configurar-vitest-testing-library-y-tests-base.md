# Task 09: Configurar Vitest + Testing Library y tests base

> Parte del plan: `../plan.md` — leerlo para contexto de entidades y dominio.

## Skill / Capa

Testing: Vitest + Testing Library. Cubre dominio puro (`packages/data-model`) y componentes clave de `apps/web`.

## Objetivo

Instalar y configurar Vitest con `@testing-library/react` y `jsdom`, escribir tests para:

1. Lógica pura de `packages/data-model` (`format.ts`, `domain.ts`).
2. El fallback de foto (`InitialsAvatar` + `AboutSection`) del Task 03.

## Depende De

- Task 03: para poder testear el fallback de foto.
- Task 07: el script `test` ya debe existir en `package.json` raíz.

## Archivos a Crear/Editar

- `package.json` (raíz) — editar devDependencies y script `test`
- `vitest.workspace.ts` (raíz) — crear
- `packages/data-model/src/domain.test.ts` — crear
- `packages/data-model/src/format.test.ts` — crear
- `apps/web/src/components/AboutSection.test.tsx` — crear

## Detalles de Implementación

### 1. Dependencias en `package.json` raíz

Agregar a `devDependencies`:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.0",
    "vitest": "^3.0.0"
  }
}
```

- Usar versiones publicadas hace más de 7 días. Ajustar patch según disponibilidad.
- `@vitejs/plugin-react` ya existe en `apps/web`, pero a nivel raíz puede necesitarse para el workspace de web. Revisar: si Vitest workspace referencia el `vite.config.ts` de `apps/web`, no es necesario duplicar. Si se crea un config propio, sí.

### 2. `vitest.workspace.ts` (raíz)

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "data-model",
      root: "./packages/data-model",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    test: {
      name: "web",
      root: "./apps/web",
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
    },
  },
]);
```

Crear `apps/web/src/test/setup.ts`:

```ts
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

Asegurar que `apps/web/tsconfig.json` incluya `src/test/setup.ts` (actualmente `include: ["src"]` lo cubre).

### 3. Tests de dominio puro

#### `packages/data-model/src/format.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { formatDateRange, formatMonthYear } from "./format";

describe("formatMonthYear", () => {
  it('formats "2025-08" as "Aug 2025"', () => {
    expect(formatMonthYear("2025-08")).toBe("Aug 2025");
  });
});

describe("formatDateRange", () => {
  it('renders "Present" for null end date', () => {
    expect(formatDateRange("2025-08", null)).toBe("Aug 2025 — Present");
  });

  it("renders closed range", () => {
    expect(formatDateRange("2023-04", "2025-08")).toBe("Apr 2023 — Aug 2025");
  });
});
```

#### `packages/data-model/src/domain.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { getFeaturedProjects, sortJobsByDateDesc } from "./domain";
import type { Job, Project } from "./types";

describe("getFeaturedProjects", () => {
  it("returns only featured projects", () => {
    const projects: Project[] = [
      { id: "a", name: "A", tech: [], description: "", status: "live", featured: true },
      { id: "b", name: "B", tech: [], description: "", status: "live", featured: false },
    ];
    expect(getFeaturedProjects(projects)).toHaveLength(1);
    expect(getFeaturedProjects(projects)[0]?.id).toBe("a");
  });
});

describe("sortJobsByDateDesc", () => {
  it("places current job (null endDate) first", () => {
    const jobs: Job[] = [
      {
        id: "past",
        title: "Past",
        company: "X",
        startDate: "2017-07",
        endDate: "2020-01",
        bullets: [],
        tech: [],
      },
      {
        id: "current",
        title: "Current",
        company: "Y",
        startDate: "2025-08",
        endDate: null,
        bullets: [],
        tech: [],
      },
    ];
    const sorted = sortJobsByDateDesc(jobs);
    expect(sorted[0]?.id).toBe("current");
  });
});
```

Ajustar los mocks para cumplir `Project` y `Job` exactos (incluyendo campos requeridos).

### 4. Test de fallback de foto

#### `apps/web/src/components/AboutSection.test.tsx`

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AboutSection } from "./AboutSection";

describe("AboutSection", () => {
  it("renders initials avatar when photo fails to load", () => {
    render(<AboutSection text="About text" photo="missing.jpg" />);

    const img = screen.getByAltText("Portrait of Fernando Pailhe") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));

    expect(screen.getByLabelText(/FP initials avatar/i)).toBeInTheDocument();
    expect(screen.queryByAltText("Portrait of Fernando Pailhe")).not.toBeInTheDocument();
  });
});
```

Notas:

- `AboutSection` usa `useState`, por lo que el test se debe ejecutar en jsdom.
- Si el componente aún no expone `onError` o el fallback, corregir primero en Task 03.
- `toBeInTheDocument` requiere `@testing-library/jest-dom`; importarlo en `setup.ts`:
  ```ts
  import "@testing-library/jest-dom/vitest";
  ```

## Fuera de Alcance

- No escribir tests exhaustivos de todos los componentes; cubrir solo dominio puro y el fallback de foto.
- No configurar coverage thresholds.
- No cambiar el flujo de datos para tests (no introducir dependencias de test en runtime).

## Verificación

- [ ] `pnpm install` resuelve sin errores.
- [ ] `pnpm test` corre y todos los tests pasan.
- [ ] `pnpm typecheck` pasa (los archivos `.test.ts` deben incluirse en `tsconfig` o no emitir errores).
- [ ] `pnpm build` pasa (Vitest no debe incluirse en el bundle de producción).

## Handoff

- Produce: suite de tests base que se ejecuta con `pnpm test` y se corre en CI (Task 08).
- Próximo task: Task 14 (prerender) y Task 17 (verificación final) usan `pnpm test`.
