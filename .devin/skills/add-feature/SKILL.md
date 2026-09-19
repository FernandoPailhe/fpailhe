---
name: add-feature
description: >
  Receta para agregar una entidad/feature de punta a punta en el monorepo Ferpa
  (data-model → services → queries → domain → components → routes). Usar cuando
  se pida agregar una entidad nueva end-to-end.
triggers:
  - user
---

# Agregar una entidad/feature de punta a punta

Receta para agregar una nueva entidad de dominio (ej. "Product", "Event",
"Article") desde el tipo hasta la pantalla.

## Orden de ejecución

Siempre de abajo hacia arriba: **data-model → services → queries → domain → components → routes**.

## Paso 1 — Tipo en `@ferpa/data-model`

Archivo: `packages/data-model/src/types.ts`

```ts
/** Entidad nueva del dominio. */
export interface Product {
  id: string;
  name: string;
  price: number;
}
```

- Agregar al barrel: `packages/data-model/src/index.ts` (ya exporta
  `./types`, solo verificar).
- Si necesita funciones de cálculo → `domain.ts`.
- Si necesita formatters → `format.ts`.

## Paso 2 — Dato de ejemplo (opcional, para desarrollo)

Archivo: `apps/web/public/data/products.json`

```json
[
  { "id": "p1", "name": "Widget", "price": 29.99 }
]
```

## Paso 3 — Fetcher en services

Archivo: `apps/web/src/services/dataService.ts`

```ts
import type { Product } from "@ferpa/data-model";
import { http } from "./httpClient";

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await http.get<Product[]>("/products.json");
  return data;
}
```

## Paso 4 — Query key + hook

Archivo: `apps/web/src/queries/keys.ts` — agregar key:

```ts
export const queryKeys = {
  // ... existentes
  products: ["products"] as const,
};
```

Archivo: `apps/web/src/queries/useProductsQuery.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "../services/dataService";
import { queryKeys } from "./keys";

export function useProductsQuery() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: fetchProducts,
    staleTime: 5 * 60_000,
  });
}
```

## Paso 5 — Hook de dominio (si hay lógica derivada)

Archivo: `apps/web/src/domain/useProductStats.ts`

```ts
import { useMemo } from "react";
import { useProductsQuery } from "../queries/useProductsQuery";

export function useProductStats() {
  const { data: products, ...rest } = useProductsQuery();

  const totalValue = useMemo(
    () => products?.reduce((sum, p) => sum + p.price, 0) ?? 0,
    [products],
  );

  return { products, totalValue, ...rest };
}
```

## Paso 6 — Componente organismo

Archivo: `apps/web/src/components/ProductList.tsx`

- Importa de `@ferpa/ui` (atoms/molecules) + datos de dominio.
- Maneja loading/error con `LoadingState` / `ErrorState`.

## Paso 7 — Ruta

Archivo: `apps/web/src/routes/ProductsPage.tsx` — ver skill `add-route`.

## Checklist

- [ ] Tipo definido una sola vez en `@ferpa/data-model`.
- [ ] Fetcher en `services/`, no en componentes.
- [ ] Query key centralizada en `keys.ts`.
- [ ] Lógica derivada en `domain/`, no en componentes.
- [ ] Ruta deep-linkable en `App.tsx`.
- [ ] `pnpm typecheck` y `pnpm build` pasan.
