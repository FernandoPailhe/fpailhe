import { Link } from "react-router-dom";

import { uiCopy } from "../lib/copy";

/** Tarjeta de un universo en la lista: título, descripción y enlace de entrada. */
export function UniverseListItem({
  title,
  description,
  to,
  tag,
}: {
  title: string;
  description?: string;
  to: string;
  tag?: string;
}) {
  return (
    <li className="uv-card-surface uv-list-item">
      <h2 className="uv-list-title">
        {title}
        {tag !== undefined && <> <span className="uv-tag">{tag}</span></>}
      </h2>
      {description !== undefined && description.length > 0 && (
        <p className="uv-text-dim">{description}</p>
      )}
      <Link className="uv-btn uv-btn--primary" to={to}>
        {uiCopy.list.enter}
      </Link>
    </li>
  );
}
