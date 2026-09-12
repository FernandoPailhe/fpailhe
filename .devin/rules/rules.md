---
trigger: always
---

# Reglas de arquitectura — Ferpa Monorepo Template

Estas reglas son invariantes. Antes de romper una, se cambia este
documento — para humanos y para IA trabajando sobre este repo.

---

## 1. Separación de paquetes (dependencia unidireccional)

```
apps/web/            → composición: rutas, fetching, estado, organismos
packages/ui/          → presentación: theme + componentes atómicos
packages/data-model/  → dominio: tipos, cálculo, formatters
```

```
apps/web  →  @ferpa/ui           ✅
apps/web  →  @ferpa/data-model   ✅
@ferpa/ui →  @ferpa/data-model   ❌ PROHIBIDO
```

- **`@ferpa/data-model`** no importa React ni `@ferpa/ui`. Es lógica pura.
- **`@ferpa/ui`** no importa `@ferpa/data-model` ni conoce el dominio.
  Props genéricas (`shortCode`, `color`, `label`), nunca entidades.
  Si un componente necesita saber del dominio → es organismo → `apps/web/src/components`.
- **`apps/web`** es la única capa que combina dominio + presentación.

## 2. Theme: una sola fuente de verdad

Archivo dueño: **`packages/ui/src/theme/tokens.ts`**.

- Prohibido hex, font-family o radio literal fuera de `tokens.ts`.
- `tailwind.config.ts` y `ThemeProvider` leen el mismo objeto; no hay
  sincronización manual.
- Colores por-entidad de dominio NO van en el theme — son datos.
- Rebrand = editar `tokens.ts` (o pasar tokens alternativos a `<ThemeProvider>`).

## 3. Data flow estricto

```
JSON/API → services/ → queries/ → domain/ → components/
```

- Componentes nunca llaman a `axios`, `fetch` ni `services/` directo.
- Lógica de dominio vive una sola vez en `@ferpa/data-model`.
- Migrar de JSON estático a API real = tocar solo `services/dataService.ts`
  + `VITE_API_BASE_URL`.
- Datos viven en JSON (o futuro backend), nunca hardcodeados en componentes.

## 4. Estado: cuatro tipos, cuatro lugares

| Tipo | Dónde |
|---|---|
| Servidor (datos remotos) | TanStack Query (`queries/`) |
| Derivado (cálculos) | `domain/` hooks con `useMemo` |
| Navegación | URL vía React Router — nunca un store |
| UI efímera | Zustand (`store/`) — último recurso |

- Derivable de la URL → no duplicar en Zustand.
- Derivable de una query → no duplicar en Zustand ni `useState`.

## 5. Rutas deep-linkables

Toda vista tiene URL propia. Prohibido estado de pantalla que no sea
alcanzable por URL (tabs sin cambio de URL, modales sin ruta).

## 6. Componentes: atoms → molecules → organismos → routes

| Nivel | Ubicación | Sabe del dominio |
|---|---|---|
| Atoms | `packages/ui/src/atoms/` | No |
| Molecules | `packages/ui/src/molecules/` | No |
| Organismos | `apps/web/src/components/` | Sí |
| Routes | `apps/web/src/routes/` | Sí (vía hooks) |

- Atoms: mínima unidad visual, sin estado propio relevante.
- Molecules: combinan atoms + comportamiento genérico (ej. `Dialog`).
- Organismos: combinan atoms/molecules con datos reales del dominio.
- Routes: una por ruta, delega lógica a hooks de `domain/`.

Un componente que mezcla fetch + cálculo + JSX de múltiples
responsabilidades se parte según esta tabla.

## 7. Accesibilidad

- Elementos interactivos: `focus-visible:outline`.
- Modales (`Dialog`): foco atrapado, `Escape` cierra, clic en overlay cierra,
  foco devuelto al disparador.
- Controles deshabilitados: `<button disabled>` real, no `<div onClick>`.
- No anidar interactivos (`<button>` dentro de `<a>`, etc.).

## 8. TypeScript estricto

- `strict: true` + `noUncheckedIndexedAccess: true` en `tsconfig.base.json`.
  `array[i]` es `T | undefined` — se maneja, no se apaga.
- Cero `any`. Un `as` solo cuando se puede demostrar (y se comenta por qué).
- Tipos de dominio definidos **una sola vez** en `@ferpa/data-model`.

## 9. Dependencias

Stack fijo: Vite, React 18, TypeScript, React Router, TanStack Query,
Zustand, Tailwind, Axios, pnpm workspaces. Agregar una librería nueva
requiere justificar que nada del stack actual alcanza.

## 10. Checklist pre-commit

1. `pnpm typecheck` — sin `any`, sin errores de `noUncheckedIndexedAccess`.
2. `pnpm build` — los tres paquetes compilan en orden.
3. Colores/fuentes nuevos en `tokens.ts`, no hardcodeados.
4. Componentes de `packages/ui` agnósticos del dominio.
5. Pantalla nueva tiene ruta propia en `App.tsx`.
6. Estado nuevo: ¿es Zustand o debería ser query / derivado / URL?

## 11. Responsive

- Breakpoint único: `mobile` = `max-width: 680px`.
- Tabla → tarjeta: usar `display: grid` con `col-start`/`row-start`
  explícitos, NO `flex-wrap` + `flex-1`.
- Textos truncables: `min-w-0` + `truncate` en contenedor.
- Verificar a ≤680px antes de entregar.

## 12. Convenciones de código

- Named exports, nunca `export default`.
- Un componente por archivo; nombre de archivo = nombre del componente.
- Hooks custom: prefijo `use` + dominio (`useItemsQuery`, `useStandings`).
- Barrel exports (`index.ts`) en cada carpeta de `packages/`.
- Imports de packages vía scope (`@ferpa/data-model`, `@ferpa/ui`),
  nunca paths relativos entre paquetes.
- Archivos en inglés (nombres, exports). Comentarios y strings de UI en español.