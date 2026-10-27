import type { EventView } from "../application/types";

const GLYPHS: Record<EventView["tone"], string> = {
  gain: "▲",
  loss: "▼",
  neutral: "●",
};

/** Evento del turno: glifo + texto por tono (el color nunca va solo). */
export function EventChip({ event }: { event: EventView }) {
  return (
    <li className={`uv-event uv-event--${event.tone}`}>
      <span className="uv-event-glyph" aria-hidden="true">
        {GLYPHS[event.tone]}
      </span>
      {event.text}
    </li>
  );
}
