# Task 03: Implementar fallback de foto del About

> Parte del plan: `../plan.md` — leerlo para entidades (`AboutAside`) y componentes.

## Skill / Capa

- `add-ui-component.md` para crear el atom `InitialsAvatar`.
- Organismo `AboutSection` en `apps/web/src/components/AboutSection.tsx` para integrar el fallback.

## Objetivo

Crear un componente visual genérico `InitialsAvatar` que muestre un monograma con iniciales sobre el sistema de diseño actual, y usarlo como fallback en `AboutSection` cuando la foto referenciada en `about-aside.json` falte o falle al cargar. Documentar dónde debe colocarse la foto real.

## Depende De

— (puede ejecutarse en paralelo con Task 01 y Task 02; no depende de datos).

## Archivos a Crear/Editar

- `packages/ui/src/atoms/InitialsAvatar.tsx` — crear
- `packages/ui/src/atoms/index.ts` — editar (barrel export)
- `apps/web/src/components/AboutSection.tsx` — editar

## Detalles de Implementación

### 1. Atom `InitialsAvatar`

Props:

```ts
export interface InitialsAvatarProps {
  /** Dos iniciales, ej. "FP". */
  initials: string;
  /** Tamaño base en píxeles (default: 220 para coincidir con la foto actual). */
  size?: number;
  className?: string;
}
```

- Renderizar un `<div>` o `<span>` con las iniciales centradas.
- Usar solo tokens de `packages/ui/src/theme/tokens.ts` vía clases Tailwind:
  - fondo: `bg-gold-soft`
  - texto: `text-gold` o `text-gold-bright`
  - borde: `border border-line`
  - tipografía: `font-display`
- Default `size={220}` para que ocupe el mismo espacio que la foto actual (`max-w-[220px]`).
- Named export `export function InitialsAvatar`.

Ejemplo de markup objetivo (no es obligatorio copiar literal, sí respetar tokens):

```tsx
<span
  className={`inline-flex aspect-square items-center justify-center border border-line bg-gold-soft font-display text-gold ${className}`}
  style={{ width: size, height: size }}
  aria-label={`${initials} initials avatar`}
>
  {initials}
</span>
```

Registrar en `packages/ui/src/atoms/index.ts`:

```ts
export * from "./InitialsAvatar";
```

### 2. `AboutSection`

Actual:

```tsx
<img
  src={`/${photo}`}
  alt="Portrait of Fernando Pailhe"
  className="w-full max-w-[220px] border border-line"
/>
```

Reemplazar por lógica con estado de error:

```tsx
const [hasError, setHasError] = useState(false);

// ...

{
  hasError ? (
    <InitialsAvatar initials="FP" className="w-full max-w-[220px]" />
  ) : (
    <img
      src={`/${photo}`}
      alt="Portrait of Fernando Pailhe"
      className="w-full max-w-[220px] border border-line"
      onError={() => setHasError(true)}
    />
  );
}
```

- Si `photo` está vacío o el archivo no existe, `onError` dispara y se muestra el fallback.
- `InitialsAvatar` debe importarse de `@ferpa/ui`.
- Agregar un comentario JSDoc arriba del componente documentando el path esperado para reemplazar el fallback:

```tsx
/**
 * Aside de "about": texto + foto a dos columnas en desktop.
 *
 * Para reemplazar el fallback del monograma, colocar una foto en
 * `apps/web/public/fernando-photo.jpg` y asegurar que `about-aside.json`
 * tenga `"photo": "fernando-photo.jpg"`.
 */
```

## Fuera de Alcance

- No modificar `about-aside.json`.
- No generar la foto real.
- No tocar estilos de impresión (el avatar puede mostrarse en print; es aceptable).

## Verificación

- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] En desarrollo (`pnpm dev`), al no existir `fernando-photo.jpg`, la sección About muestra el monograma "FP" con estilos del sistema (fondo suave terracota, borde line).
- [ ] Colocando un archivo `apps/web/public/fernando-photo.jpg` real, la imagen se muestra en lugar del monograma.
- [ ] Existe un test que cubre el fallback (Task 09).

## Handoff

- Produce: atom `InitialsAvatar` exportado desde `@ferpa/ui`, y `AboutSection` robusto a la ausencia de foto.
- Próximo task: Task 09 (tests) verifica este fallback; Task 12 (a11y) revisa el `alt`/aria-label.
