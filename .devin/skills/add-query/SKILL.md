---
name: add-query
description: >
  Receta para agregar un hook de TanStack Query (fetcher en services, key
  centralizada, hook useXxxQuery). Usar para nuevas fuentes de datos o
  endpoints.
triggers:
  - user
---

# Agregar un hook de TanStack Query

## Anatomía del data flow

```
services/dataService.ts  →  queries/keys.ts  →  queries/useXxxQuery.ts
         ↑                                              ↓
   httpClient.ts                                components / domain hooks
```

## Paso 1 — Fetcher en services

Archivo: `apps/web/src/services/dataService.ts`

```ts
import type { MiEntidad } from "@ferpa/data-model";
import { http } from "./httpClient";

export async function fetchMiEntidad(): Promise<MiEntidad[]> {
  const { data } = await http.get<MiEntidad[]>("/mi-entidad.json");
  return data;
}
```

Reglas:
- Siempre tipar el retorno con interfaces de `@ferpa/data-model`.
- Usar la instancia `http` (nunca `axios` directo).
- Un fetcher por endpoint / recurso.

## Paso 2 — Query key

Archivo: `apps/web/src/queries/keys.ts`

```ts
export const queryKeys = {
  // ... existentes
  miEntidad: ["miEntidad"] as const,
  // Con parámetros:
  miEntidadById: (id: string) => ["miEntidad", id] as const,
};
```

Convenciones:
- Keys son `as const` para inferencia de tipos.
- Keys con parámetros: función que retorna el array.
- Centralizar siempre en este archivo — nunca strings sueltos en hooks.

## Paso 3 — Hook de query

Archivo: `apps/web/src/queries/useMiEntidadQuery.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchMiEntidad } from "../services/dataService";
import { queryKeys } from "./keys";

export function useMiEntidadQuery() {
  return useQuery({
    queryKey: queryKeys.miEntidad,
    queryFn: fetchMiEntidad,
    staleTime: 5 * 60_000,
  });
}
```

### Con parámetro

```ts
export function useMiEntidadByIdQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.miEntidadById(id),
    queryFn: () => fetchMiEntidadById(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
```

### staleTime recomendado

| Frecuencia de cambio | staleTime |
|---|---|
| Datos casi estáticos | `Infinity` |
| Cambian cada minutos | `5 * 60_000` (5 min) |
| Tiempo real | `0` (default) |

## Paso 4 — Consumir en componentes o domain hooks

```tsx
// En un componente de ruta:
const { data, isLoading, isError } = useMiEntidadQuery();
if (isLoading) return <LoadingState />;
if (isError) return <ErrorState />;

// En un domain hook (lógica derivada):
const miEntidad = useMiEntidadQuery();
const derivado = useMemo(() => calcular(miEntidad.data), [miEntidad.data]);
```

## Invalidación

Cuando una mutación cambia datos en el servidor:

```ts
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

const queryClient = useQueryClient();
await queryClient.invalidateQueries({ queryKey: queryKeys.miEntidad });
```

## Checklist

- [ ] Fetcher tipado en `services/dataService.ts`.
- [ ] Key centralizada en `queries/keys.ts`.
- [ ] Hook con nombre `use<Entidad>Query`.
- [ ] `staleTime` explícito según frecuencia de cambio.
- [ ] Componentes no llaman a `services/` directamente.
- [ ] `pnpm typecheck` pasa.
