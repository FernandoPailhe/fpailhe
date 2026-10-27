import type { ParameterView } from "../application/types";
import { uiCopy } from "../lib/copy";
import type { ResolvedIcon } from "../theme/iconResolver";

import { UniverseIcon } from "./UniverseIcon";

/**
 * Un parámetro activo: ícono (teñido con `--uv-param-<id>`), nombre,
 * valor y barra de progreso accesible (`role="meter"`). Muestra el
 * último delta y el chip de riesgo de umbral cuando aplican.
 */
export function ParameterBar({
  view,
  icon,
  showName,
}: {
  view: ParameterView;
  icon: ResolvedIcon;
  showName: boolean;
}) {
  const riskText =
    view.risk === "low"
      ? uiCopy.hud.riskLow
      : view.risk === "high"
        ? uiCopy.hud.riskHigh
        : null;
  const valueText = `${view.value} ${uiCopy.hud.of} ${view.max}${
    riskText !== null ? `, ${uiCopy.hud.riskAt(view.risk === "low" ? "low" : "high")}` : ""
  }`;

  return (
    <div className="uv-param" title={view.name}>
      <UniverseIcon
        resolved={icon}
        decorative
        colorVar={`var(--uv-param-${view.id})`}
      />
      <span className={showName ? "uv-param-name" : "uv-sr-only"}>{view.name}</span>
      <span className="uv-param-value">{view.value}</span>
      <div
        className="uv-param-track"
        role="meter"
        aria-label={view.name}
        aria-valuemin={view.min}
        aria-valuemax={view.max}
        aria-valuenow={view.value}
        aria-valuetext={valueText}
      >
        <div
          className="uv-param-fill"
          style={{
            transform: `scaleX(${Math.min(1, Math.max(0, view.ratio))})`,
            background: `var(--uv-param-${view.id})`,
          }}
        />
      </div>
      {view.delta !== null && (
        <span className={`uv-param-delta uv-param-delta--${view.delta > 0 ? "up" : "down"}`}>
          {view.delta > 0 ? `▲ +${view.delta}` : `▼ ${view.delta}`}
        </span>
      )}
      {riskText !== null && (
        <span className="uv-risk-chip">
          {view.risk === "low" ? "▼" : "▲"} {riskText}
        </span>
      )}
    </div>
  );
}
