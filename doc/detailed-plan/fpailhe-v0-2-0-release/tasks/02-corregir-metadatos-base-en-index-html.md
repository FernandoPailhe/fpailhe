# Task 02: Corregir metadatos base en index.html

> Parte del plan: `../plan.md` — leerlo para contexto de metadatos y dominio.

## Skill / Capa

Edición del HTML entry point (`apps/web/index.html`) y comentarios de dominio en `packages/data-model/src/types.ts`.

## Objetivo

Corregir la meta description que hoy menciona `fpailhe.dev` (dominio que no existe), agregar canonical y asegurar que `lang`, `title` y `description` sean consistentes.

## Depende De

— (ninguno; puede ejecutarse en paralelo con Task 01 y Task 03).

## Archivos a Crear/Editar

- `apps/web/index.html` — editar
- `packages/data-model/src/types.ts` — editar (comentario de dominio interno)

## Detalles de Implementación

### `apps/web/index.html`

El archivo actual tiene:

```html
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fernando Pailhe — Mobile Engineer</title>
    <meta
      name="description"
      content="Fernando Pailhe — Mobile Engineer. React Native and Kotlin, from first commits to rescued codebases. fpailhe.dev"
    />
  </head>
</html>
```

Cambios exactos:

1. Reemplazar la `meta description` para usar `fpailhe.com` (o quitar el dominio al final) y evitar duplicar el title exacto.
2. Agregar `<link rel="canonical" href="https://fpailhe.com/" />` después de la description.
3. Dejar `lang="en"` y `title` intactos (ya son correctos).

Ejemplo de head resultante (sin tocar links de fonts):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fernando Pailhe — Mobile Engineer</title>
    <meta
      name="description"
      content="Fernando Pailhe — Mobile Engineer. React Native and Kotlin, from first commits to rescued codebases. https://fpailhe.com"
    />
    <link rel="canonical" href="https://fpailhe.com/" />
    <!-- preconnect/fonts... -->
  </head>
</html>
```

### `packages/data-model/src/types.ts`

En el comentario de cabecera cambiar:

```ts
/**
 * Modelo de datos del sitio Ferpa (fpailhe.dev).
```

por:

```ts
/**
 * Modelo de datos del sitio Ferpa (fpailhe.com).
```

No modificar ninguna interface.

## Fuera de Alcance

- No agregar Open Graph ni Twitter Cards acá; es Task 04.
- No agregar favicon ni theme-color acá; es Task 05.
- No tocar contenido dinámico de rutas.

## Verificación

- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] En `dist/index.html` (o inspeccionando el source) se ve `fpailhe.com` en la meta description y no `fpailhe.dev`.
- [ ] Existe `<link rel="canonical" href="https://fpailhe.com/" />`.
- [ ] No hay referencias a `fpailhe.dev` en `packages/data-model/src/types.ts`.

## Handoff

- Produce: `index.html` con metadatos base corregidos, listo para recibir OG/Twitter/favicon en Tasks 04 y 05.
