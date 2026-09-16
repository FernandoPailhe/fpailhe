export interface MediaFigureProps {
  type: "image" | "video" | "embed";
  src: string;
  /** Alt text para `image`. */
  alt?: string;
  /** Título accesible del iframe para `embed`. */
  title?: string;
  caption?: string;
  /** Poster para `video`. */
  poster?: string;
  className?: string;
}

/**
 * Figura de media genérica: imagen, video local o embed externo
 * (iframe). Agnóstica del dominio — recibe props primitivas.
 */
export function MediaFigure({
  type,
  src,
  alt,
  title,
  caption,
  poster,
  className = "",
}: MediaFigureProps) {
  return (
    <figure className={className}>
      {type === "image" ? (
        <img src={src} alt={alt ?? ""} loading="lazy" className="w-full border border-line" />
      ) : null}
      {type === "video" ? (
        <video
          src={src}
          controls
          preload="metadata"
          poster={poster}
          className="w-full border border-line"
        />
      ) : null}
      {type === "embed" ? (
        <iframe
          src={src}
          title={title ?? "Embedded media"}
          loading="lazy"
          allowFullScreen
          className="aspect-video w-full border border-line"
        />
      ) : null}
      {caption ? (
        <figcaption className="mt-2 font-mono text-xs text-ink-faint">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
