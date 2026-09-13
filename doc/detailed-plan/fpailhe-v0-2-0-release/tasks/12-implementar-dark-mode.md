# Task 12: Implementar dark mode

> Parte del plan: `../plan.md` — leerlo para contexto de theme y tokens.

## Skill / Capa

`theming` + `add-ui-component` para el toggle.

## Objetivo

Agregar un tema oscuro derivado del sistema de tokens existente, respetando `prefers-color-scheme`, con un toggle persistente en `localStorage`, sin romper los estilos de impresión del CV ni la accesibilidad del foco.

## Depende De

— (puede ejecutarse en paralelo con Tasks 07, 10, 13; no depende de otros).

## Archivos a Crear/Editar

- `packages/ui/src/theme/tokens.ts` — editar (quitar comentario `TEMPLATE` si aún existe, aunque eso se cubre en Task 16; aquí solo para referencia)
- `packages/ui/src/theme/darkTokens.ts` — crear
- `packages/ui/src/theme/index.ts` — editar (barrel export)
- `packages/ui/src/theme/ThemeProvider.tsx` — editar
- `apps/web/src/components/DarkModeToggle.tsx` — crear
- `apps/web/src/components/Nav.tsx` — editar (integrar toggle)
- `apps/web/src/styles/globals.css` — editar

## Detalles de Implementación

### 1. Tokens oscuros en `packages/ui/src/theme/darkTokens.ts`

Crear un objeto `darkTokens` con el **mismo shape** que `themeTokens`. Invertir la base y el texto; mantener `gold` como acento.

```ts
import type { ThemeTokens } from "./tokens";

export const darkTokens: ThemeTokens = {
  color: {
    canvas: "oklch(17% 0.010 75)",
    surface: "oklch(22% 0.012 75)",
    surfaceRaised: "oklch(25% 0.014 75)",
    line: "oklch(35% 0.010 75)",
    lineSoft: "oklch(30% 0.010 75)",

    ink: "oklch(94% 0.010 75)",
    inkDim: "oklch(75% 0.010 75)",
    inkFaint: "oklch(65% 0.010 75)",

    gold: "#C1502E",
    goldBright: "#D96A44",
    goldSoft: "rgba(193, 80, 46, 0.18)",

    crimson: "#e56c5e",
    crimsonBright: "#f48a7d",

    silver: "oklch(75% 0.010 75)",
    silverSoft: "rgba(200,200,200,0.10)",
    bronze: "oklch(75% 0.010 75)",
    bronzeSoft: "rgba(200,200,200,0.10)",
    bronzeBright: "oklch(94% 0.010 75)",

    parchment: "oklch(94% 0.010 75)",
    parchmentRaised: "oklch(90% 0.012 75)",
    parchmentInk: "oklch(17% 0.010 75)",
    parchmentInkDim: "oklch(35% 0.010 75)",
    parchmentLine: "oklch(80% 0.010 75)",
  },
  font: {
    display: "'Spectral', Georgia, serif",
    ui: "'Work Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
  },
  radius: {
    sm: "0px",
    md: "0px",
    lg: "0px",
    pill: "999px",
  },
};
```

Nota: `silver`/`bronze` se quitan en Task 16 si no se usan; dejarlos acá con valores coherentes para no romper builds intermedias.

### 2. `ThemeProvider.tsx`

Extender para soportar tema oscuro:

- Estado interno `theme: "light" | "dark" | "system"`.
- Al montar, leer `localStorage.getItem("theme")` y `window.matchMedia("(prefers-color-scheme: dark)").matches`.
- Aplicar `lightTokens` o `darkTokens` según estado resuelto.
- Exponer un contexto (`ThemeContext`) con `theme`, `resolvedTheme`, `setTheme`.
- No modificar `:root` manualmente en CSS; seguir usando `buildCssVariables` + `root.style.setProperty`.
- Agregar listener a `matchMedia` para cambios de `prefers-color-scheme` cuando `theme === "system"`.

Ejemplo de API expuesta:

```ts
export interface ThemeContextValue {
  theme: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => void;
}
```

### 3. `DarkModeToggle.tsx`

Crear organismo en `apps/web/src/components/DarkModeToggle.tsx`:

- Usa `useTheme()` del `ThemeProvider` (agregar hook exportado).
- Botón con icono/emoji? Preferir texto "Light / Dark / System" o un icono simple. **No usar emojis a menos que el usuario lo pida.** Usar texto accesible: "Switch theme" con `aria-label`.
- Botón usa `Button` atom de `@ferpa/ui` (variant `ghost-gold` o similar) para mantener foco y tokens.
- Persistir cambio en `localStorage`.

```tsx
export function DarkModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost-gold"
      aria-label={`Theme: ${theme}. Current: ${resolvedTheme}. Toggle.`}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}
```

O si se quiere ciclar light/dark/system:

```tsx
const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
onClick={() => setTheme(next[theme])}
```

Elegir la opción más simple para el executor; el criterio es que funcione y sea accesible.

### 4. `Nav.tsx`

Integrar `DarkModeToggle` dentro de la barra de navegación, al final de los links. Asegurar que no se anide interactivo.

```tsx
<div className="flex items-center gap-6">
  <ul className="flex items-center gap-6">...</ul>
  <DarkModeToggle />
</div>
```

### 5. `globals.css`

Actualizar el bloque base:

```css
@layer base {
  :root {
    color-scheme: light dark;
  }
  /* ... */
}
```

La media query `@media print` **no debe cambiar**; ya fija colores light con `!important`, lo cual está bien.

Agregar clase para forzar `color-scheme` si es necesario:

```css
[data-theme="dark"] {
  color-scheme: dark;
}
```

Pero el `ThemeProvider` ya aplica variables CSS. Esto es solo para inputs nativos.

## Fuera de Alcance

- No agregar animaciones complejas de transición.
- No modificar tokens de impresión.
- No modificar componentes que no usen tokens (deberían adaptarse solos al cambiar CSS vars).

## Verificación

- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] En dev, cambiar `prefers-color-scheme: dark` en DevTools cambia los colores automáticamente (con `theme="system"`).
- [ ] El toggle persiste la preferencia en `localStorage` y la aplica al recargar.
- [ ] `window.print()` en `/cv` imprime con colores claros (la media query print anula las variables oscuras).
- [ ] El toggle tiene `focus-visible:outline` visible.

## Handoff

- Produce: sistema de dark mode integrado en theme y toggle en Nav.
- Próximo task: Task 17 valida visualmente y en print.
