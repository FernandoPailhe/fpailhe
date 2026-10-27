import type { Game } from "../domain/models";

export interface UniverseEntry {
  slug: string;
  basePath: "content" | "fixture";
  game: Game;
}

const gameModules = import.meta.glob("../content/*/game.json", { import: "default" });
// Solo en desarrollo y tests: incluye el universo de pruebas.
// import.meta.env.DEV/MODE se resuelven en build time: en producción queda {}
// y los fixtures no entran al bundle.
const fixtureGameModules =
  import.meta.env.DEV || import.meta.env.MODE === "test"
    ? import.meta.glob("../testing/fixtures/*/game.json", { import: "default" })
    : {};

export function isDevOrTest(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === "test";
}

function slugFromGamePath(path: string, basePath: "content" | "fixture"): string | undefined {
  const prefix = basePath === "content" ? "../content/" : "../testing/fixtures/";
  const suffix = "/game.json";
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) return undefined;
  return path.slice(prefix.length, -suffix.length);
}

async function loadEntries(): Promise<UniverseEntry[]> {
  const entries: UniverseEntry[] = [];
  const load = async (
    modules: Record<string, () => Promise<unknown>>,
    basePath: "content" | "fixture",
  ) => {
    for (const [path, loader] of Object.entries(modules)) {
      const slug = slugFromGamePath(path, basePath);
      if (!slug) continue;
      const game = (await loader()) as Game;
      if (game.slug !== slug) {
        if (import.meta.env.DEV) {
          console.warn(
            `universes: game.slug "${game.slug}" no coincide con la carpeta "${slug}"; se omite`,
          );
        }
        continue;
      }
      entries.push({ slug, basePath, game });
    }
  };
  await load(gameModules, "content");
  await load(fixtureGameModules, "fixture");
  return entries;
}

/** Universos listables: publicados siempre; borradores solo si se pide (o DEV). */
export async function listUniverses(opts?: {
  includeUnpublished?: boolean;
}): Promise<UniverseEntry[]> {
  const includeUnpublished = opts?.includeUnpublished ?? import.meta.env.DEV;
  const entries = await loadEntries();
  return entries
    .filter((e) => includeUnpublished || e.game.status === "published")
    .sort((a, b) => a.game.title.default.localeCompare(b.game.title.default));
}

export async function findUniverse(slug: string): Promise<UniverseEntry | undefined> {
  const entries = await loadEntries();
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) return undefined;
  if (entry.game.status !== "published" && !isDevOrTest()) return undefined;
  return entry;
}
