import { useEffect } from "react";

export type UniverseSeoPage = "index" | "universe" | "play" | "end";

const SITE = "Fernando Pailhe";

/** Título del documento por página (`"<Universo> — Universos — <Sitio>"`). */
export function titleFor(page: UniverseSeoPage, gameTitle?: string): string {
  if (page === "index") return `Universos — ${SITE}`;
  return `${gameTitle ?? "Universo"} — Universos — ${SITE}`;
}

/**
 * Setea `document.title` y, si `noindex`, agrega
 * `<meta name="robots" content="noindex">` (se quita al desmontar).
 */
export function useDocumentTitle(title: string, options?: { noindex?: boolean }) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    let meta: HTMLMetaElement | undefined;
    if (options?.noindex) {
      meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex";
      document.head.appendChild(meta);
    }
    return () => {
      document.title = previous;
      meta?.remove();
    };
  }, [title, options?.noindex]);
}
