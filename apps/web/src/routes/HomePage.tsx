import type { Item } from "@ferpa/data-model";
import { useItemsQuery } from "../queries/useItemsQuery";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

/**
 * TEMPLATE: Página de inicio de ejemplo. Muestra una lista de items
 * obtenidos del servicio de datos. Reemplazá con tu contenido real.
 */
export function HomePage() {
  const { data: items, isLoading, isError } = useItemsQuery();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState label="Error al cargar los datos." />;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 font-display text-3xl font-bold text-ink">
        Template App
      </h1>

      <p className="mb-6 text-ink-dim">
        Este es un monorepo template con Vite + React + TypeScript + TanStack Query + Zustand + Tailwind.
        Editá los archivos en <code className="font-mono text-gold-bright">apps/web/src</code> para
        empezar tu proyecto.
      </p>

      {items && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item: Item) => (
            <li
              key={item.id}
              className="rounded-md border border-line bg-surface p-4"
            >
              <strong className="font-ui text-sm font-bold text-ink">
                {item.name}
              </strong>
              <p className="mt-1 text-sm text-ink-dim">{item.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-faint">No hay items cargados.</p>
      )}
    </section>
  );
}
