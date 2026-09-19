---
name: theming
description: >
  Guía para modificar/extender el theme (tokens.ts como fuente única, Tailwind
  y CSS vars automáticos). Usar para colores, fuentes o radios nuevos.
triggers:
  - user
---

# Modificar o extender el theme

## Fuente única de verdad

`packages/ui/src/theme/tokens.ts` → `themeTokens`

Todo el pipeline:

```
tokens.ts
  ├── ThemeProvider.tsx  →  CSS variables en :root (runtime)
  └── tokenExports.ts   →  tailwind.config.ts (build time)
```

Resultado: una sola edición recolorea/retipografía toda la app.

## Agregar un color nuevo

### 1. Agregar token

Archivo: `packages/ui/src/theme/tokens.ts`

```ts
export const themeTokens = {
  color: {
    // ... existentes
    success: "#22c55e",
    successSoft: "rgba(34,197,94,0.14)",
  },
  // ...
} as const;
```

### 2. Usar en Tailwind

Automático — `tailwind.config.ts` ya genera clases desde `themeTokens.color`:

```html
<div class="bg-success text-success">...</div>
```

### 3. Usar como CSS variable

Automático — `ThemeProvider` genera `--color-success` en `:root`:

```css
color: var(--color-success);
```

## Agregar una tipografía

### 1. Token

```ts
font: {
  // ... existentes
  handwriting: "'Caveat', cursive",
},
```

### 2. Google Fonts

Agregar en `apps/web/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet" />
```

### 3. Usar

```html
<span class="font-handwriting">Texto manuscrito</span>
```

## Agregar un radio

```ts
radius: {
  // ... existentes
  xl: "20px",
},
```

Uso: `class="rounded-xl"`.

## Cambiar el theme completo en runtime

```tsx
import { ThemeProvider } from "@ferpa/ui";
import { darkTokens } from "./themes/dark";
import { lightTokens } from "./themes/light";

<ThemeProvider tokens={isDark ? darkTokens : lightTokens}>
  <App />
</ThemeProvider>
```

El objeto debe cumplir `ThemeTokens` (mismo shape que `themeTokens`).

## Lo que NO va en tokens

- Colores por-entidad de dominio (vienen de datos/JSON).
- Breakpoints (definidos en `tailwind.config.ts`, no en tokens).
- Espaciado (Tailwind defaults son suficientes).

## Checklist

- [ ] Nuevo valor en `tokens.ts`, no hardcodeado en componentes.
- [ ] Si es tipografía: agregar `<link>` en `index.html`.
- [ ] Verificar que `pnpm build` genera las clases de Tailwind.
- [ ] Verificar CSS variables en DevTools (`:root`).
