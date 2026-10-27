import { uiCopy } from "../lib/copy";

import type { SessionStatus } from "./statusForPath";

/** Pill de estado de la partida: EN CURSO (punto parpadeante) / TERMINADA. */
export function StatusPill({ status }: { status: SessionStatus }) {
  return (
    <span className={`uv-pill uv-pill--${status}`}>
      <span className="uv-pill-dot" aria-hidden="true" />
      {status === "live" ? uiCopy.status.live : uiCopy.status.ended}
    </span>
  );
}
