import { describe, expect, it } from "vitest";
import appSource from "../../App.tsx?raw";
import prerenderSource from "../../../scripts/prerender.mjs?raw";

/**
 * Regresión de #17/#19: el hosting es estático con 404 real para rutas sin
 * archivo emitido (`not_found_handling = "404-page"` en wrangler.toml). El
 * link de sala `/lab/trymate?room=<id>` es una URL directa — si el prerender
 * no emite el shell de la ruta, el guest recibe un 404 y la sala nunca arranca.
 * Este test verifica que toda ruta concreta del router tenga un HTML emitido.
 */
function spaRoutes(): string[] {
  // <Route path="cv" /> / <Route index /> → rutas concretas declaradas.
  const routes: string[] = [];
  if (/<Route\s+index[\s/>]/.test(appSource)) routes.push("/");
  for (const match of appSource.matchAll(/path="([^"]+)"/g)) {
    const p = match[1]!;
    if (p === "*" || p.includes(":")) continue; // catch-all y parametrizadas
    routes.push(p.startsWith("/") ? p : `/${p}`);
  }
  return routes;
}

function emittedRoutes(): Set<string> {
  // `route: "/..."` cubre tanto las pages prerendered como SHELL_ROUTES.
  const emitted = new Set<string>();
  for (const match of prerenderSource.matchAll(/route:\s*"([^"]+)"/g)) {
    emitted.add(match[1]!);
  }
  return emitted;
}

describe("static app shells", () => {
  it("emits an index.html for every concrete SPA route (share links must not 404)", () => {
    const emitted = emittedRoutes();
    const missing = spaRoutes().filter((route) => !emitted.has(route));
    expect(missing).toEqual([]);
  });

  it("emits the TryMate shell — the room share link depends on it", () => {
    expect(emittedRoutes()).toContain("/lab/trymate");
  });
});
