import type { CSSProperties } from "react";

import type { ResolvedIcon } from "../theme/iconResolver";

/**
 * Ícono del universo. `kind: "svg"` inyecta el markup ya sanitizado por
 * `sanitizeSvg` (whitelist de elementos/atributos: sin scripts, handlers
 * ni href), por eso `dangerouslySetInnerHTML` es seguro acá — único uso
 * permitido en el módulo.
 */
export function UniverseIcon({
  resolved,
  size = 20,
  decorative = false,
  colorVar,
}: {
  resolved: ResolvedIcon;
  size?: number;
  decorative?: boolean;
  colorVar?: string;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    color: colorVar,
  };
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": resolved.label };

  if (resolved.kind === "svg") {
    return (
      <span
        className="uv-icon"
        style={style}
        {...a11y}
        dangerouslySetInnerHTML={{ __html: resolved.svg }}
      />
    );
  }
  return (
    <span className="uv-icon uv-icon--initial" style={style} {...a11y}>
      {resolved.initial}
    </span>
  );
}
