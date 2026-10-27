import type { OutcomeView } from "../application/types";
import { uiCopy } from "../lib/copy";

import { EventChip } from "./EventChip";
import { useFocusOnMount } from "./useFocusOnMount";

/**
 * Resultado de la decisión: la elección, el texto de resultado, los
 * eventos (parámetros agrupados primero) y el botón de continuar
 * (o "Ver final" si la partida terminó, con su etiqueta de resultado).
 */
export function OutcomePanel({
  outcome,
  onContinue,
}: {
  outcome: OutcomeView;
  onContinue: () => void;
}) {
  const continueRef = useFocusOnMount<HTMLButtonElement>(outcome.ended);

  const paramEvents = outcome.events.filter((e) => e.parameterId !== undefined);
  const otherEvents = outcome.events.filter((e) => e.parameterId === undefined);

  return (
    <article className="uv-outcome" aria-labelledby="uv-outcome-sr-title">
      <h2 id="uv-outcome-sr-title" className="uv-sr-only">
        {uiCopy.outcome.title}
      </h2>
      {outcome.ended && outcome.result !== undefined && (
        <p className={`uv-end-result uv-end-result--${outcome.result}`}>
          <span className="uv-end-glyph" aria-hidden="true">
            {uiCopy.end.glyph[outcome.result]}
          </span>
          {uiCopy.end.result[outcome.result]}
        </p>
      )}
      <p className="uv-outcome-chosen">{uiCopy.outcome.chosen(outcome.chosenLabel)}</p>
      {outcome.outcomeText !== undefined && (
        <p className="uv-outcome-text">{outcome.outcomeText}</p>
      )}
      {paramEvents.length > 0 && (
        <ul className="uv-events">
          {paramEvents.map((e, i) => (
            <EventChip key={`p-${e.parameterId ?? i}`} event={e} />
          ))}
        </ul>
      )}
      {otherEvents.length > 0 && (
        <ul className="uv-events uv-events--misc">
          {otherEvents.map((e, i) => (
            <EventChip key={`m-${i}`} event={e} />
          ))}
        </ul>
      )}
      <div className="uv-actions">
        <button
          ref={continueRef}
          type="button"
          className="uv-btn uv-btn--primary"
          onClick={onContinue}
        >
          {outcome.ended ? uiCopy.outcome.seeEnd : uiCopy.outcome.continue}
        </button>
      </div>
    </article>
  );
}
