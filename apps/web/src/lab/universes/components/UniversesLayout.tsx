import { Link, Outlet, useLocation, useParams } from "react-router-dom";

import { useUniverses, useUniverseTheme } from "../application";
import { localize } from "../domain/engine/localize";
import { uiCopy } from "../lib/copy";

import { StatusPill } from "./StatusPill";
import { statusForPath } from "./statusForPath";
import { ThemeScope } from "./ThemeScope";
import "./universes.css";

/** Layout del módulo: ThemeScope + cabecera/pie con la estética del universo. */
export function UniversesLayout() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const { theme, locale } = useUniverseTheme(slug);
  const { data: universes } = useUniverses();

  const status = statusForPath(pathname);
  const displayLocale =
    locale ?? (typeof navigator !== "undefined" ? navigator.language : "es");
  const universe = slug !== undefined ? universes?.find((u) => u.slug === slug) : undefined;
  const universeName =
    universe !== undefined ? localize(universe.game.title, displayLocale) : undefined;

  return (
    <ThemeScope theme={theme} locale={locale}>
      <a className="uv-skip" href="#main-content">
        {uiCopy.layout.skipToContent}
      </a>
      <div className="uv-shell">
        <header className="uv-header">
          <div className="uv-header-side">
            {slug !== undefined && (
              <Link className="uv-back" to="/lab/universes">
                {uiCopy.layout.backToUniverses}
              </Link>
            )}
            {universeName !== undefined && (
              <span className="uv-universe-name">{universeName}</span>
            )}
          </div>
          {status !== null && <StatusPill status={status} />}
        </header>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="uv-footer">{uiCopy.layout.footer}</footer>
      </div>
    </ThemeScope>
  );
}
