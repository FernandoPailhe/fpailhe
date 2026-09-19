---
name: add-route
description: >
  Receta para agregar una ruta/página deep-linkable en apps/web. Usar para
  nuevas pantallas o URLs.
triggers:
  - user
---

# Agregar una nueva ruta / página

## Regla clave

Toda vista visible → URL propia → deep-linkable.

## Paso 1 — Crear el componente de página

Archivo: `apps/web/src/routes/NombrePage.tsx`

```tsx
import { useAlgoQuery } from "../queries/useAlgoQuery";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

export function NombrePage() {
  const { data, isLoading, isError } = useAlgoQuery();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Título</h1>
      {/* contenido */}
    </section>
  );
}
```

Convenciones:
- Nombre: `<Sustantivo>Page` (PascalCase).
- Un archivo = una ruta.
- Delega fetch a hooks de `queries/`, lógica a `domain/`.
- Usa `LoadingState` / `ErrorState` para estados de carga.

## Paso 2 — Registrar en `App.tsx`

```tsx
import { NombrePage } from "./routes/NombrePage";

// Dentro de <Routes>:
<Route path="nombre" element={<NombrePage />} />
```

## Paso 3 — Rutas anidadas (con layout)

Si varias rutas comparten un layout (header, sidebar, footer):

1. Crear layout en `apps/web/src/layout/`:

```tsx
import { Outlet } from "react-router-dom";

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header>...</header>
      <main className="flex-1"><Outlet /></main>
      <footer>...</footer>
    </div>
  );
}
```

2. Anidar en `App.tsx`:

```tsx
<Route path="admin" element={<AdminLayout />}>
  <Route index element={<DashboardPage />} />
  <Route path="users" element={<UsersPage />} />
</Route>
```

## Paso 4 — Rutas con parámetros

```tsx
<Route path="items/:itemId" element={<ItemDetailPage />} />
```

En el componente:

```tsx
import { useParams } from "react-router-dom";

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  // usar itemId para fetch o filtro
}
```

## Paso 5 — Modales como rutas (deep-linkable)

Para que un modal sea linkeable:

```tsx
<Route path="items/:itemId" element={<ItemsPage />}>
  <Route path="detail/:detailId" element={<ItemsPage />} />
</Route>
```

En `ItemsPage`, leer el param y renderizar el modal condicionalmente:

```tsx
const { detailId } = useParams();
// Si detailId existe, abrir <Dialog>
```

## Checklist

- [ ] Ruta registrada en `App.tsx`.
- [ ] URL deep-linkable (copiar URL en nueva pestaña funciona).
- [ ] Componente maneja loading / error.
- [ ] No mezcla fetch + cálculo en el JSX.
- [ ] Layout compartido usa `<Outlet />`, no copypaste de header/footer.
