import type { IconView, ParameterView } from "../application/types";
import type { ID } from "../domain/models";
import { resolveIcon } from "../theme/iconResolver";

import { ParameterBar } from "./ParameterBar";

/**
 * Grilla de parámetros activos (en orden de `content.parameters`).
 * 1 columna en móvil, `auto-fit` en pantallas anchas.
 */
export function ParametersPanel({
  parameters,
  icons,
  seenParamIds,
}: {
  parameters: ParameterView[];
  icons: Record<ID, IconView>;
  seenParamIds: ReadonlySet<ID>;
}) {
  if (parameters.length === 0) return null;
  return (
    <div className="uv-params">
      {parameters.map((p) => (
        <ParameterBar
          key={p.id}
          view={p}
          icon={resolveIcon({
            iconId: p.iconId,
            fallbackTags: [p.key, "parameter"],
            name: p.name,
            icons,
          })}
          showName={!seenParamIds.has(p.id)}
        />
      ))}
    </div>
  );
}
