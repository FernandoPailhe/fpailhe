# Task 11: Mostrar links y capturas opcionales en proyectos

> Parte del plan: `../plan.md` — leerlo para la definición de `Project`, `ProjectLink` y convenciones de UI.

## Skill / Capa

- `add-ui-component` para modificar `ProjectCard` (molecule) y `ProjectsSection` (organismo).
- `add-feature` para la integración UI-dominio.

## Objetivo

Actualizar `ProjectCard` para mostrar múltiples links (App Store, Play Store, GitHub, web) y una captura opcional, manteniendo compatibilidad con el campo `link` legacy. Documentar los proyectos cuyos links faltan.

## Depende De

- Task 01: descripción de Tune-Up corregida.
- Task 10: entidad `Project` extendida con `links` y `screenshot`.

## Archivos a Crear/Editar

- `packages/ui/src/molecules/ProjectCard.tsx` — editar
- `apps/web/src/components/ProjectsSection.tsx` — editar
- `doc/project-links.md` — crear (documentación de links faltantes)

## Detalles de Implementación

### 1. `ProjectCard`

Props actuales:

```ts
export interface ProjectCardProps {
  name: string;
  context?: string;
  tech: string[];
  description: string;
  status: "live" | "in-progress";
  link?: string;
}
```

Extender a:

```ts
export interface ProjectCardLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface ProjectCardProps {
  name: string;
  context?: string;
  tech: string[];
  description: string;
  status: "live" | "in-progress";
  /** @deprecated pass `links` instead */
  link?: string;
  links?: ProjectCardLink[];
  imageUrl?: string;
}
```

- `ProjectCard` no importa `@ferpa/data-model`; sigue siendo agnóstico del dominio.
- Si `links` está vacío o no existe pero `link` sí existe, mostrar un link usando `link`.
- Si `links` existe, renderizarlos en una lista (`<ul>`) con `TextLink`.
- `imageUrl` opcional: renderizar `<img>` encima o al lado del contenido con `alt=""` si es decorativa, o `alt={`Screenshot of ${name}`}` si es informativa. Elegir según diseño.
- Usar solo tokens Tailwind: `bg-surface-raised`, `border-line`, `text-gold`, `font-ui`, `font-mono`, etc.

Ejemplo de estructura aproximada:

```tsx
<article className="flex h-full flex-col bg-surface-raised p-5">
  {imageUrl ? (
    <img src={imageUrl} alt={`${name} screenshot`} className="mb-4 border border-line" />
  ) : null}
  <header>...</header>
  <p className="mt-3 flex-1 font-ui text-sm leading-relaxed text-ink-dim">{description}</p>
  {effectiveLinks.length > 0 ? (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {effectiveLinks.map((l) => (
        <li key={l.href}>
          <TextLink href={l.href} external={l.external}>
            {l.label}
          </TextLink>
        </li>
      ))}
    </ul>
  ) : null}
  <footer className="mt-4 flex flex-wrap items-center gap-2">...</footer>
</article>
```

### 2. `ProjectsSection`

Mapear `project.links` a `ProjectCardLink`:

```ts
const projectLinks = project.links?.map((l) => ({
  label: l.label ?? defaultLabel(l.type),
  href: l.url,
  external: true,
}));
```

- Los links de tipo `appStore`, `playStore`, `github`, `website` son todos externos.
- Función helper local `defaultLabel(type)` devuelve: "App Store", "Play Store", "GitHub", "Website".
- Pasar `imageUrl={project.screenshot ? `/${project.screenshot}` : undefined}`.
- Seguir pasando `link={project.link}` durante la transición.

### 3. Documentación de links faltantes

Crear `doc/project-links.md`:

```markdown
# Project links — pending verification

The following projects need public links. Only verified links were added to `apps/web/public/data/projects.json`.

- EQM: internal Techint app; no public link expected.
- Tune-Up: add App Store / Play Store / website once published.
- HangApp: add public store links if available.
- Be Soul: add public store links if available.
- PassApp: add public store links if available.
- El Puma Contigo: add public store links if available.

When a link is verified, add a `ProjectLink` entry to `projects.json` and a screenshot to `apps/web/public/project-screenshots/<id>.png`.
```

## Fuera de Alcance

- No modificar `types.ts`; eso fue Task 10.
- No generar imágenes de captura.
- No crear una página de detalle de proyecto.

## Verificación

- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] `pnpm test` pasa (añadir test de `ProjectCard` si es posible).
- [ ] En `/`, las tarjetas de proyectos con `links` muestran los links clickeables.
- [ ] Los proyectos sin links no rompen el layout ni muestran una sección vacía.
- [ ] Las capturas (si están en `public/project-screenshots/`) se renderizan.
- [ ] `doc/project-links.md` existe y lista los links pendientes.

## Handoff

- Produce: UI de proyectos con soporte de links múltiples y captura opcional.
- Próximo task: Task 17 (verificación final) verifica visualmente.
