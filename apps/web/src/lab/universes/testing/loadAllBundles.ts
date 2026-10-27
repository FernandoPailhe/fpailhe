import type { RawGameBundle } from "../domain/engine/types";

const contentTop = import.meta.glob("../content/*/*.json", {
  eager: true,
  import: "default",
});
const contentCards = import.meta.glob("../content/*/cards/*.json", {
  eager: true,
  import: "default",
});
const fixtureTop = import.meta.glob("./fixtures/*/*.json", {
  eager: true,
  import: "default",
});
const fixtureCards = import.meta.glob("./fixtures/*/cards/*.json", {
  eager: true,
  import: "default",
});

export interface LoadedBundle {
  slug: string;
  origin: "content" | "fixture";
  raw: RawGameBundle;
}

interface Collected {
  top: Map<string, unknown>;
  cards: unknown[];
}

function collect(
  top: Record<string, unknown>,
  cards: Record<string, unknown>,
  prefix: string,
): Map<string, Collected> {
  const bySlug = new Map<string, Collected>();
  const ensure = (slug: string) => {
    let e = bySlug.get(slug);
    if (!e) {
      e = { top: new Map(), cards: [] };
      bySlug.set(slug, e);
    }
    return e;
  };
  for (const [path, mod] of Object.entries(top)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length); // "<slug>/<file>.json"
    const slash = rest.indexOf("/");
    if (slash < 0) continue;
    const slug = rest.slice(0, slash);
    const name = rest.slice(slash + 1).replace(/\.json$/, "");
    ensure(slug).top.set(name, mod);
  }
  for (const [path, mod] of Object.entries(cards)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash < 0) continue;
    ensure(rest.slice(0, slash)).cards.push(mod);
  }
  return bySlug;
}

function toBundle(collected: Collected): RawGameBundle {
  const read = <T>(name: string): T | undefined =>
    collected.top.get(name) as T | undefined;
  // Cast en el borde: los JSON no pueden comprobarse con `satisfies`.
  return {
    game: read("game"),
    stages: read("stages") ?? [],
    parameters: read("parameters") ?? [],
    branches: read("branches") ?? [],
    characters: read("characters") ?? [],
    powers: read("powers") ?? [],
    badges: read("badges") ?? [],
    icons: read("icons") ?? [],
    assets: read("assets") ?? [],
    cards: collected.cards,
    aesthetic: read("aesthetic"),
  } as unknown as RawGameBundle;
}

/** Carga sincrónica de todos los bundles (`content/*` y `fixtures/*`). Solo tests. */
export function loadAllBundles(): LoadedBundle[] {
  const out: LoadedBundle[] = [];
  for (const [slug, c] of collect(contentTop, contentCards, "../content/")) {
    if (c.top.has("game")) out.push({ slug, origin: "content", raw: toBundle(c) });
  }
  for (const [slug, c] of collect(fixtureTop, fixtureCards, "./fixtures/")) {
    if (c.top.has("game")) out.push({ slug, origin: "fixture", raw: toBundle(c) });
  }
  return out;
}
