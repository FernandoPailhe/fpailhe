# Task 01: Pipeline de tema — perfil estético → variables CSS

> Parte del plan: `../plan.md` — "Decisiones de Diseño" #2–#6 y "Reglas de estilo". Spec de referencia: `doc/specs/lab/universes/narratives-aesthetics.md` §5, §6.1–6.2, §9.

## Skill / Capa

`theming` + `add-feature` paso 1 (funciones puras). Sin React en `theme/` salvo `useColorScheme.ts`.

## Objetivo

Funciones puras y probadas que convierten un `AestheticProfile` (más el esquema claro/oscuro y los `ThemeOverride` activos) en un diccionario de variables CSS `--uv-*`, con tema de plataforma como respaldo. Es la base de todos los demás tasks.

## Depende De

- Plan `universes-engine`, task 11 (`ThemeInput` en `application/types.ts`) y task 01 (tipos).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/theme/contrast.ts` + `contrast.test.ts` — crear
- `apps/web/src/lab/universes/theme/platformTheme.ts` + `platformTheme.test.ts` — crear
- `apps/web/src/lab/universes/theme/composeTheme.ts` + `composeTheme.test.ts` — crear
- `apps/web/src/lab/universes/theme/themeVars.ts` + `themeVars.test.ts` — crear
- `apps/web/src/lab/universes/theme/useColorScheme.ts` — crear
- `apps/web/src/lab/universes/theme/index.ts` — crear (barrel)
- `packages/ui/src/theme/tokens.ts` / `tokenExports.ts` — editar **solo si** falta exportar un valor imprescindible (agregar, nunca cambiar valores existentes)

## Detalles de Implementación

1. **Leer** `packages/ui/src/theme/tokens.ts` y `apps/web/tailwind.config.ts`; anotar los tokens de fondo, superficie, borde, texto, texto atenuado y acento (`gold`, `ink`, `ink-dim`… — nombres reales). Este es el único dato que el task no puede fijar de antemano.
2. **`contrast.ts`**: `parseColor(input: string): { r: number; g: number; b: number; a: number } | null` (soporta `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`); `relativeLuminance(c)`; `contrastRatio(a: string, b: string): number | null`; `meetsAA(ratio, size: "normal" | "large")` (4.5 / 3). Pura.
3. **`platformTheme.ts`**: `getPlatformColorScheme(): ColorScheme` — completa **todos** los campos de `ColorScheme` (ver `models.ts §9`) usando valores de `@ferpa/ui` (importar desde `@ferpa/ui`, nunca desde `@ferpa/data-model`); los semánticos que no existan en los tokens (`positive`, `negative`, `warning`, `info`, `overlay`) se agregan **en `tokens.ts`**. Más `getPlatformDesignValues()` con `radius`, `borderWidth`, `spacingUnit`, `motion` por defecto (números simples, sin colores). Test: todos los campos son strings no vacíos y cumplen AA los pares `textPrimary/background`, `textPrimary/surface`, `accentContrast/accent`.
4. **`composeTheme.ts`**:
   ```ts
   export interface ResolvedTheme {
     scheme: "light" | "dark";
     colors: ColorScheme;
     parameterColors: Record<ID, string>;
     fonts: { display: string; body: string; accent: string };      // font-family CSS ya armado con fallback
     scale: Record<keyof Typography["scale"], { family: string; size: number; lineHeight: number; weight: number; letterSpacing?: number; uppercase?: boolean }>;
     radius: DesignTokens["radius"]; borderWidth: number; spacingUnit: number;
     shadows: { card: string; modal: string };
     motion: DesignTokens["motion"];
   }
   export function composeTheme(input: ThemeInput, prefersDark: boolean | undefined): ResolvedTheme;
   ```
   - Esquema: si el perfil define ambos (`light` y `dark`) y `prefersDark !== undefined` ⇒ el del sistema; si no, `defaultScheme`; si el elegido no existe ⇒ el otro; si no hay ninguno ⇒ tema de plataforma.
   - Sin `aesthetic` ⇒ todo desde `platformTheme`.
   - Cada color de `ColorScheme` que no parsee con `parseColor` se reemplaza por el del tema de plataforma (no rompe).
   - Overrides: aplicar en orden `activeOverrides[].colors` (parcial) sobre los colores base; `cardTransition` del último override que lo defina.
   - Fuentes: `family` entre comillas + `fallback.join(", ")`; si falta el rol `accent`, usar el de `body`.
   - Funciones puras y deterministas.
5. **`themeVars.ts`**: `themeToCssVars(t: ResolvedTheme): Record<string, string>` con: `--uv-color-<campo>` (los 13 de `ColorScheme`), `--uv-param-<parameterId>`, `--uv-font-display|body|accent`, `--uv-type-<title|cardText|option|label|number|caption>-size|lh|weight|ls|transform|font`, `--uv-radius-sm|md|lg` (en `px`), `--uv-border-width`, `--uv-space` (unidad base), `--uv-shadow-card|modal`, `--uv-motion-fast|base|slow` (en `ms`), `--uv-easing`, `--uv-card-transition` (el tipo como string). Los ids de parámetro se sanean a `[A-Za-z0-9_-]` (ya vienen así por `E_ID_CHARS`).
6. **`useColorScheme.ts`**: `usePrefersDark(): boolean | undefined` — `undefined` en SSR / sin `window.matchMedia`; escucha cambios con `matchMedia("(prefers-color-scheme: dark)")` y limpia el listener. Nada de browser APIs a nivel de módulo.

## Fuera de Alcance

- Componentes y CSS (tasks 02+).
- Carga de fuentes externas (decisión #6): solo se arma `font-family`.
- Evaluar condiciones de `ThemeOverride` (ya lo hace el hook del plan del motor).

## Verificación

- [ ] Tests: `parseColor`/`contrastRatio` con casos conocidos (`#000` vs `#fff` = 21); `composeTheme` con perfil completo, sin perfil, perfil con un solo esquema, `prefersDark` true/false/undefined, color inválido (cae al de plataforma), override que cambia `accent`; `themeToCssVars` contiene las claves esperadas y ninguna variable vacía.
- [ ] Test de aceptación (criterio global 1): dos `AestheticProfile` distintos producen `themeToCssVars` distintos sin tocar ningún componente.
- [ ] `pnpm vitest run --project web src/lab/universes/theme`, `pnpm typecheck`, `pnpm lint`.
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/lab/universes/theme` solo encuentra literales dentro de archivos `*.test.ts`.

## Handoff

Produce: `composeTheme`, `themeToCssVars`, `getPlatformColorScheme`, `contrastRatio`/`meetsAA`/`parseColor`, `usePrefersDark`. Task 02 monta `ThemeScope`; Task 07 reutiliza `contrast.ts` en la validación del build.
