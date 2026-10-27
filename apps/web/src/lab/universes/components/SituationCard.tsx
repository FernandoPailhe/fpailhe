import type { CardView } from "../application/types";
import { uiCopy } from "../lib/copy";

import { CardMedia } from "./CardMedia";
import { useFocusOnMount } from "./useFocusOnMount";

/**
 * Carta de situación: hablante opcional (retrato + nombre + título),
 * medio opcional, texto a ancho de lectura. La transición de entrada
 * (`slide`/`fade`/`flip`/`stack`) la resuelve el CSS a partir de
 * `data-card-transition` del `.uv`; el `key={card.id}` en la página la
 * reaplica en cada carta.
 */
export function SituationCard({ card, mark }: { card: CardView; mark?: string }) {
  const { speaker } = card;
  const titleRef = useFocusOnMount<HTMLHeadingElement>(card.id);
  return (
    <article className="uv-card" aria-labelledby="uv-card-sr-title">
      <h2 id="uv-card-sr-title" ref={titleRef} tabIndex={-1} className="uv-sr-only">
        {uiCopy.card.situation}
      </h2>
      {speaker !== undefined && (
        <header className="uv-card-speaker">
          {speaker.portraitUrl !== undefined && (
            <img
              className="uv-card-portrait"
              src={speaker.portraitUrl}
              alt={speaker.portraitAlt ?? ""}
            />
          )}
          <div>
            <p className="uv-card-speaker-name">{speaker.name}</p>
            {speaker.title !== undefined && (
              <p className="uv-card-speaker-title">{speaker.title}</p>
            )}
          </div>
        </header>
      )}
      {card.media !== undefined && <CardMedia media={card.media} />}
      {card.media === undefined && speaker === undefined && mark !== undefined && (
        <span className="uv-card-mark" aria-hidden="true">
          {mark}
        </span>
      )}
      <p className="uv-card-text">{card.text}</p>
    </article>
  );
}
