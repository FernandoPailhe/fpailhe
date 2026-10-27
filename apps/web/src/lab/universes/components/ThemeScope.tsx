import type { CSSProperties, ReactNode } from "react";

import type { ThemeInput } from "../application/types";
import { composeTheme, themeToCssVars, usePrefersDark } from "../theme";

/**
 * Contenedor tematizado `.uv`: aplica las variables `--uv-*` del universo
 * activo (o del tema de plataforma) y el esquema claro/oscuro resuelto.
 * Nunca toca `document`/`window` directamente.
 */
export function ThemeScope({
  theme,
  locale,
  children,
}: {
  theme: ThemeInput;
  locale?: string;
  children: ReactNode;
}) {
  const prefersDark = usePrefersDark();
  const resolved = composeTheme(theme, prefersDark);
  return (
    <div
      className="uv"
      data-scheme={resolved.scheme}
      data-card-transition={resolved.motion.cardTransition}
      lang={locale}
      style={themeToCssVars(resolved) as CSSProperties}
    >
      {children}
    </div>
  );
}
