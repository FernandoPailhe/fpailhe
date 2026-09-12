---
skill: add-ui-component
---

# Agregar un componente de UI

## Decidir el nivel correcto

| Pregunta | Sí → | No → |
|---|---|---|
| ¿Es la unidad visual mínima? | Atom | ↓ |
| ¿Combina atoms con comportamiento genérico? | Molecule | ↓ |
| ¿Necesita datos del dominio (`@ferpa/data-model`)? | Organismo | — |

| Nivel | Ubicación | Puede importar |
|---|---|---|
| Atom | `packages/ui/src/atoms/` | Solo React + theme CSS vars |
| Molecule | `packages/ui/src/molecules/` | React + otros atoms |
| Organismo | `apps/web/src/components/` | Todo: `@ferpa/ui` + `@ferpa/data-model` + hooks |

## Crear un Atom

Archivo: `packages/ui/src/atoms/Tag.tsx`

```tsx
export interface TagProps {
  label: string;
  variant?: "default" | "accent";
  className?: string;
}

/** Etiqueta inline de una o dos palabras. */
export function Tag({ label, variant = "default", className = "" }: TagProps) {
  const variantClass = variant === "accent"
    ? "bg-gold-soft text-gold-bright"
    : "bg-surface-raised text-ink-dim";

  return (
    <span className={`inline-block rounded-pill px-2.5 py-1 font-mono text-xs ${variantClass} ${className}`}>
      {label}
    </span>
  );
}
```

Convenciones:
- Named export, nunca `export default`.
- Props interface exportada con nombre `<Componente>Props`.
- `className` opcional para composición externa.
- Solo clases de Tailwind con tokens (no hex inline).
- JSDoc de una línea describiendo el componente.

Registrar en barrel: `packages/ui/src/atoms/index.ts`

```ts
export * from "./Tag";
```

## Crear una Molecule

Igual que atom, pero en `packages/ui/src/molecules/`.

Puede importar otros atoms:

```tsx
import { Badge } from "../atoms/Badge";
import { Tag } from "../atoms/Tag";
```

Registrar en `packages/ui/src/molecules/index.ts`.

## Crear un Organismo

Archivo: `apps/web/src/components/ItemCard.tsx`

```tsx
import type { Item } from "@ferpa/data-model";
import { Badge } from "@ferpa/ui";

export interface ItemCardProps {
  item: Item;
  onClick?: () => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <div
      className="rounded-md border border-line bg-surface p-4 transition-colors hover:bg-surface-raised"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <strong className="font-ui text-sm font-bold text-ink">{item.name}</strong>
      <p className="mt-1 text-sm text-ink-dim">{item.description}</p>
    </div>
  );
}
```

Los organismos NO van en barrel de `packages/ui`; se importan directamente.

## Cuándo promover / degradar

- Si un organismo se usa en 2+ proyectos y se le pueden quitar las props
  de dominio → promover a molecule en `packages/ui`.
- Si una molecule empieza a recibir props de dominio → degradar a
  organismo en `apps/web/src/components/`.

## Checklist

- [ ] Nivel correcto (atom / molecule / organismo).
- [ ] Named export + Props interface exportada.
- [ ] Sin hex/font inline — solo tokens de Tailwind.
- [ ] Registrado en barrel si es `packages/ui`.
- [ ] `className` prop para composición.
- [ ] Accesibilidad: roles, focus states si es interactivo.
- [ ] `pnpm typecheck` pasa.
