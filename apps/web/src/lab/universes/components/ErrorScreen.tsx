import { Link } from "react-router-dom";

import { uiCopy } from "../lib/copy";

import { useFocusOnMount } from "./useFocusOnMount";

/**
 * Pantalla de error: mensaje claro sin detalles técnicos.
 * `notFound` ⇒ "Universo no encontrado" + enlace a la lista; si no, "Reintentar".
 */
export function ErrorScreen({ notFound, onRetry }: { notFound: boolean; onRetry?: () => void }) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>(notFound);

  return (
    <section className="uv-error">
      <h1 ref={titleRef} tabIndex={-1} className="uv-title">
        {notFound ? uiCopy.error.notFoundTitle : uiCopy.error.title}
      </h1>
      <p className="uv-text-dim">{notFound ? uiCopy.error.notFoundMessage : uiCopy.error.message}</p>
      <div className="uv-actions">
        {notFound ? (
          <Link className="uv-btn uv-btn--ghost" to="/lab/universes">
            {uiCopy.error.backToList}
          </Link>
        ) : (
          onRetry !== undefined && (
            <button type="button" className="uv-btn uv-btn--primary" onClick={onRetry}>
              {uiCopy.error.retry}
            </button>
          )
        )}
      </div>
    </section>
  );
}
