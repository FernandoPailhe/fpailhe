import type { EndView, IconView } from "../application/types";
import type { ID } from "../domain/models";
import { uiCopy } from "../lib/copy";
import { resolveIcon } from "../theme/iconResolver";

import { UniverseIcon } from "./UniverseIcon";
import { useFocusOnMount } from "./useFocusOnMount";

/**
 * Pantalla de final: resultado como etiqueta de texto + glifo (no solo color),
 * título y texto del final, resumen, insignias y parámetros finales.
 */
export function EndScreen({
  end,
  icons = {},
  onPlayAgain,
}: {
  end: EndView;
  icons?: Record<ID, IconView>;
  onPlayAgain: () => void;
}) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>(end.result);

  return (
    <section className={`uv-end uv-end--${end.result}`}>
      <p className={`uv-end-result uv-end-result--${end.result}`}>
        <span className="uv-end-glyph" aria-hidden="true">
          {uiCopy.end.glyph[end.result]}
        </span>
        {uiCopy.end.result[end.result]}
      </p>
      <h1 ref={titleRef} tabIndex={-1} className="uv-title">
        {end.title}
      </h1>
      <p className="uv-end-text">{end.text}</p>

      <dl className="uv-end-summary">
        <div>
          <dt>{uiCopy.end.turns}</dt>
          <dd>{end.turns}</dd>
        </div>
        <div>
          <dt>{uiCopy.end.score}</dt>
          <dd>{end.score}</dd>
        </div>
        <div>
          <dt>{uiCopy.end.stage}</dt>
          <dd>{end.stageName}</dd>
        </div>
      </dl>

      {end.badges.length > 0 && (
        <div className="uv-end-badges">
          <h2 className="uv-eyebrow">{uiCopy.end.badges}</h2>
          <ul className="uv-badge-list">
            {end.badges.map((b) => (
              <li key={b.id} className="uv-badge">
                <UniverseIcon
                  resolved={resolveIcon({
                    iconId: b.iconId,
                    fallbackTags: ["badge"],
                    name: b.name,
                    icons,
                  })}
                  decorative
                  size={16}
                />
                {b.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {end.parameters.length > 0 && (
        <div className="uv-end-params">
          <h2 className="uv-eyebrow">{uiCopy.end.parameters}</h2>
          <ul className="uv-end-param-list">
            {end.parameters.map((p) => (
              <li key={p.id}>
                {p.name}: {p.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="uv-actions">
        <button type="button" className="uv-btn uv-btn--primary" onClick={onPlayAgain}>
          {uiCopy.end.playAgain}
        </button>
      </div>
    </section>
  );
}
