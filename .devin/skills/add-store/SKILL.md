---
name: add-store
description: >
  Receta para agregar un Zustand store de estado UI efímero en
  apps/web/src/store/. Usar solo cuando el estado no es query, derivado ni URL.
triggers:
  - user
---

# Agregar un Zustand store (estado UI efímero)

## Cuándo usar Zustand

Zustand es el **último recurso**. Antes de crear un store, preguntarse:

| ¿El estado es...? | → Dónde va |
|---|---|
| Datos del servidor | TanStack Query (`queries/`) |
| Derivable de datos + `useMemo` | `domain/` hooks |
| La URL actual o un param | React Router (`useParams`, `useSearchParams`) |
| Nada de lo anterior + sobrevive re-renders | ✅ Zustand (`store/`) |

Ejemplos válidos: fila expandida en tabla, sidebar abierto/cerrado,
filtro UI local que no es parte de la URL.

## Crear un store

Archivo: `apps/web/src/store/uiStore.ts`

```ts
import { create } from "zustand";

interface UiState {
  expandedRowId: string | null;
  toggleRow: (id: string) => void;
  collapseAll: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  expandedRowId: null,

  toggleRow: (id) =>
    set((state) => ({
      expandedRowId: state.expandedRowId === id ? null : id,
    })),

  collapseAll: () => set({ expandedRowId: null }),
}));
```

## Convenciones

- Un store por "dominio de UI" (no un mega-store global).
- Nombre: `use<Dominio>Store` (ej. `useUiStore`, `useFilterStore`).
- Ubicación: `apps/web/src/store/`.
- Las acciones (funciones) van dentro del store, no afuera.
- Estado mínimo: no duplicar lo que ya vive en queries o URL.

## Consumir

```tsx
import { useUiStore } from "../store/uiStore";

export function MyRow({ id }: { id: string }) {
  const expanded = useUiStore((s) => s.expandedRowId === id);
  const toggle = useUiStore((s) => s.toggleRow);

  return (
    <div onClick={() => toggle(id)}>
      {expanded && <div>Contenido expandido</div>}
    </div>
  );
}
```

### Selectores específicos para evitar re-renders

```ts
// ✅ Bien: solo re-renderiza cuando este valor cambia
const expanded = useUiStore((s) => s.expandedRowId === id);

// ❌ Mal: re-renderiza con cualquier cambio del store
const state = useUiStore();
```

## Persistencia (si hace falta)

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark" as const,
      setTheme: (theme: "dark" | "light") => set({ theme }),
    }),
    { name: "settings-storage" },
  ),
);
```

## Checklist

- [ ] ¿Realmente es Zustand? (no query, no derivado, no URL).
- [ ] Store por dominio de UI, no mega-store.
- [ ] Selectores específicos (no `useStore()` sin selector).
- [ ] Acciones dentro del store.
- [ ] `pnpm typecheck` pasa.
