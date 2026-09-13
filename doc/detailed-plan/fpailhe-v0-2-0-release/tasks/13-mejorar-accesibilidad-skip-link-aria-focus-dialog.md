# Task 13: Mejorar accesibilidad

> Parte del plan: `../plan.md` — leerlo para contexto de componentes y reglas de accesibilidad.

## Skill / Capa

`add-ui-component` + reglas de accesibilidad de `.devin/rules/rules.md`.

## Objetivo

Implementar skip-link al contenido principal, `aria-label` en la navegación, revisar foco y el dialog propio, y verificar contraste según los tokens.

## Depende De

— (puede ejecutarse en paralelo con Tasks 07, 10, 12). Si se modifica `Nav` para incluir `DarkModeToggle` (Task 12), asegurar de no crear conflictos: este task edita `Nav` para accesibilidad, Task 12 lo edita para toggle. El executor final puede combinar ambos cambios.

## Archivos a Crear/Editar

- `apps/web/index.html` — editar (skip-link)
- `apps/web/src/styles/globals.css` — editar (skip-link styles)
- `apps/web/src/components/Nav.tsx` — editar (aria-label, skip-link target)
- `packages/ui/src/molecules/Dialog.tsx` — revisar/editar (focus, overlay, aria)
- `apps/web/src/routes/HomePage.tsx` — editar (id="main-content")
- `apps/web/src/routes/CVPage.tsx` — editar (id="main-content")

## Detalles de Implementación

### 1. Skip link

En `apps/web/index.html`, justo después de `<body>`, agregar:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

En `apps/web/src/styles/globals.css`, agregar estilos:

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 100;
  padding: 8px 16px;
  background: var(--color-gold);
  color: var(--color-canvas);
  font-family: var(--font-ui);
  font-size: 14px;
  text-decoration: none;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
  outline: 2px solid var(--color-gold-bright);
  outline-offset: 2px;
}
```

Alternativa: usar clases Tailwind equivalentes si se prefiere mantener todo en utility classes:

```html
<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-50 focus:bg-gold focus:px-4 focus:py-2 focus:text-canvas focus:underline"
  >Skip to main content</a
>
```

Elegir una de las dos opciones; la segunda evita CSS custom.

### 2. `Nav.tsx`

- Agregar `aria-label="Main navigation"` al `<nav>`.
- Agregar `aria-current="page"` al link activo si se usa `NavLink` de React Router. Actualmente usa `<Link>` y `<a>` planos. Para no aumentar scope, agregar `aria-label` al `<nav>` es suficiente.
- Asegurar que el skip-link apunte a `#main-content` que se agrega en las páginas.

```tsx
<nav aria-label="Main navigation" className="no-print border-b border-line">
```

### 3. Páginas: `id="main-content"`

En `HomePage.tsx`, el `<main>` actual está fragmentado en dos. Agregar `id="main-content"` al primer `<main>` y `aria-label` opcional:

```tsx
<main id="main-content" className="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]">
```

En `CVPage.tsx`:

```tsx
<main id="main-content" className="mx-auto max-w-[760px] px-[clamp(20px,5vw,32px)] pb-16">
```

### 4. `Dialog.tsx`

Revisar y ajustar:

- El overlay ya cierra con `onMouseDown` solo si `event.target === event.currentTarget`. Cambiar a `onClick`? `onMouseDown` puede ser problemático si el usuario arrastra. Recomendar `onClick` o `onMouseDown` es aceptable; el objetivo es evitar cierre accidental al hacer clic dentro del panel. Mantener `onMouseDown` si funciona, o cambiar a `onClick`.
- `tabIndex={-1}` en el panel permite recibir foco inicial. Asegurar que el primer elemento focusable dentro del panel reciba foco. Actualmente el código ya hace esto:
  ```ts
  (focusable && focusable[0] ? focusable[0] : panel)?.focus();
  ```
- Verificar `previouslyFocused.current?.focus()` en cleanup. Correcto.
- Considerar agregar `aria-describedby` si el contenido del dialog lo requiere, pero no es obligatorio.
- Asegurar que el overlay tenga `role="presentation"` o no sea anunciado:
  ```tsx
  <div role="presentation" ... onClick={...}>
  ```
- El fondo `rgba(6,7,9,.72)` en inline style no usa tokens; es acceptable porque no hay un token de overlay semitransparente. Opcionalmente crear un token `overlay` en `tokens.ts`, pero eso implica tocar theme. **Para mantener scope, dejar el inline style o moverlo a una clase con `bg-ink/70` si Tailwind lo permite con variables.** Dado que no hay token, dejar inline y documentar.

### 5. Contraste

- Verificar que `text-ink` sobre `bg-canvas` y `text-gold` sobre `bg-gold-soft` cumplen WCAG AA usando un verificador (DevTools Lighthouse, axe, o WebAIM Contrast Checker).
- Si falla, ajustar tokens en `packages/ui/src/theme/tokens.ts` (Task 12) o `darkTokens.ts`. Ejemplo: `goldSoft` en modo oscuro debe tener suficiente contraste con `gold`.

## Fuera de Alcance

- No reescribir el dialog por completo; solo revisar y ajustar.
- No agregar roles ARIA innecesarios a elementos que ya son semánticos.
- No modificar el contenido de los datos.

## Verificación

- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] Con Tab desde el inicio de la página, el primer foco visible es el skip-link.
- [ ] Activar el skip-link mueve el foco al `<main id="main-content">`.
- [ ] `<nav>` tiene `aria-label="Main navigation"`.
- [ ] El dialog mantiene foco atrapado, Escape cierra y devuelve foco al disparador.
- [ ] Contraste de textos principales verificado contra tokens (registrar resultado en commit o comentario).

## Handoff

- Produce: mejoras de accesibilidad aplicadas a HTML, Nav, páginas y Dialog.
- Próximo task: Task 17 verifica todo visualmente y en DevTools.
