# Task 04: Agregar Open Graph y Twitter Cards

> Parte del plan: `../plan.md` — leerlo para contexto de metadatos y paths de assets.

## Skill / Capa

Edición de `apps/web/index.html`. No requiere componentes React ni TypeScript.

## Objetivo

Agregar etiquetas Open Graph y Twitter Card completas para que LinkedIn, WhatsApp, X y otros crawlers muestren preview al compartir `https://fpailhe.com`.

## Depende De

- Task 02: para no pisar la meta description corregida; se reutiliza la misma descripción.

## Archivos a Crear/Editar

- `apps/web/index.html` — editar
- `apps/web/public/og-image.png` — no crear la imagen; solo documentar su path y dimensiones esperadas.

## Detalles de Implementación

Insertar en `<head>` de `apps/web/index.html`, después del `description` y antes de los `preconnect`:

```html
<!-- Open Graph -->
<meta property="og:title" content="Fernando Pailhe — Mobile Engineer" />
<meta
  property="og:description"
  content="Fernando Pailhe — Mobile Engineer. React Native and Kotlin, from first commits to rescued codebases. https://fpailhe.com"
/>
<meta property="og:image" content="https://fpailhe.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="https://fpailhe.com/" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="en_US" />
<meta property="og:site_name" content="Fernando Pailhe" />

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Fernando Pailhe — Mobile Engineer" />
<meta
  name="twitter:description"
  content="Fernando Pailhe — Mobile Engineer. React Native and Kotlin, from first commits to rescued codebases. https://fpailhe.com"
/>
<meta name="twitter:image" content="https://fpailhe.com/og-image.png" />
```

Restricciones:

- Usar exactamente `https://fpailhe.com/` como URL canónica.
- La imagen `og-image.png` debe ser de 1200×630 píxeles y debe colocarse en `apps/web/public/og-image.png` por el operador. **Este task no genera la imagen**.
- Si se decide cambiar el nombre de la imagen, actualizar también `tasks/16-limpiar-residuos-del-template-y-actualizar-readme.md` para documentarlo.

## Fuera de Alcance

- No generar la imagen OG.
- No modificar componentes React.
- No agregar favicon ni theme-color (Task 05).

## Verificación

- [ ] `pnpm build` pasa.
- [ ] En `dist/index.html` se ven todas las meta tags listadas arriba.
- [ ] Al compartir `https://fpailhe.com` con la imagen subida, Facebook Debugger / Twitter Card Validator / LinkedIn Post Inspector muestran título, descripción e imagen.
- [ ] No hay referencias a `fpailhe.dev` en ninguna meta tag.

## Handoff

- Produce: `index.html` con OG + Twitter Cards completos.
- Próximo task: Task 05 (favicon e iconos) puede editar el mismo `<head>`; coordinar para no generar conflictos.
