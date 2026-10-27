import { useState } from "react";

import type { MediaView } from "../application/types";

/**
 * Medio de la carta: `<img>` lazy con relación de aspecto fija (sin saltos
 * de layout); `video`/`animation` con poster y controles, sin autoplay.
 * Si falla la carga se oculta y queda el retrato o el texto.
 */
export function CardMedia({ media }: { media: MediaView }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  if (media.type === "image") {
    return (
      <div className="uv-card-media">
        <img src={media.url} alt={media.alt} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className="uv-card-media">
      <video
        src={media.url}
        poster={media.posterUrl}
        controls
        preload="metadata"
        aria-label={media.alt}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
