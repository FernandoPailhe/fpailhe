import type {
  AestheticProfile,
  Badge,
  Branch,
  Character,
  Game,
  Icon,
  ID,
  MediaAsset,
  Parameter,
  Power,
  SituationCard,
  Stage,
} from "../domain/models";
import type {
  CardRepository,
  GameContentRepository,
} from "../domain/repositories";
import type { GameContent, RawCardCounters, RawGameBundle } from "../domain/engine/types";
import { assembleGameContent } from "../domain/engine/content";
import { isDevOrTest, listUniverses } from "./registry";
import { UnknownUniverseError } from "./errors";

const contentFiles = import.meta.glob("../content/*/*.json", { import: "default" });
const contentCardFiles = import.meta.glob("../content/*/cards/*.json", { import: "default" });
const fixtureFiles =
  import.meta.env.DEV || import.meta.env.MODE === "test"
    ? import.meta.glob("../testing/fixtures/*/*.json", { import: "default" })
    : {};
const fixtureCardFiles =
  import.meta.env.DEV || import.meta.env.MODE === "test"
    ? import.meta.glob("../testing/fixtures/*/cards/*.json", { import: "default" })
    : {};

const bundleCache = new Map<string, Promise<RawGameBundle>>();
const slugByGameId = new Map<ID, string>();

async function doLoadRawBundle(slug: string): Promise<RawGameBundle> {
  const contentPrefix = `../content/${slug}/`;
  const fixturePrefix = `../testing/fixtures/${slug}/`;

  let topFiles: Record<string, () => Promise<unknown>>;
  let cardFiles: Record<string, () => Promise<unknown>>;
  let prefix: string;
  if (Object.keys(contentFiles).some((k) => k.startsWith(contentPrefix))) {
    prefix = contentPrefix;
    topFiles = contentFiles;
    cardFiles = contentCardFiles;
  } else if (Object.keys(fixtureFiles).some((k) => k.startsWith(fixturePrefix))) {
    prefix = fixturePrefix;
    topFiles = fixtureFiles;
    cardFiles = fixtureCardFiles;
  } else {
    throw new UnknownUniverseError(slug);
  }

  const read = async <T>(name: string): Promise<T | undefined> => {
    const loader = topFiles[`${prefix}${name}.json`];
    return loader ? ((await loader()) as T) : undefined;
  };

  const cardLoaders = Object.entries(cardFiles)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, loader]) => loader);

  const [game, stages, parameters, branches, characters, powers, badges, icons, assets, aesthetic, cards] =
    await Promise.all([
      read<Game>("game"),
      read<Stage[]>("stages"),
      read<Parameter[]>("parameters"),
      read<Branch[]>("branches"),
      read<Character[]>("characters"),
      read<Power[]>("powers"),
      read<Badge[]>("badges"),
      read<Icon[]>("icons"),
      read<MediaAsset[]>("assets"),
      read<AestheticProfile>("aesthetic"),
      Promise.all(cardLoaders.map((loader) => loader())) as Promise<SituationCard[]>,
    ]);

  if (!game || !stages || !parameters) throw new UnknownUniverseError(slug);

  // Cast en el borde: los JSON no pueden comprobarse con `satisfies`.
  return {
    game,
    stages,
    parameters,
    branches: branches ?? [],
    characters: characters ?? [],
    powers: powers ?? [],
    badges: badges ?? [],
    icons: icons ?? [],
    assets: assets ?? [],
    cards,
    aesthetic,
  } as unknown as RawGameBundle;
}

/** Carga perezosa y memoizada por slug. */
export function loadRawBundle(slug: string): Promise<RawGameBundle> {
  let cached = bundleCache.get(slug);
  if (!cached) {
    cached = doLoadRawBundle(slug).then((bundle) => {
      slugByGameId.set(bundle.game.id, slug);
      return bundle;
    });
    bundleCache.set(slug, cached);
  }
  return cached;
}

async function slugForGameId(gameId: ID): Promise<string> {
  if (!slugByGameId.has(gameId)) {
    const entries = await listUniverses({ includeUnpublished: true });
    for (const entry of entries) slugByGameId.set(entry.game.id, entry.slug);
  }
  const slug = slugByGameId.get(gameId);
  if (!slug) throw new UnknownUniverseError(gameId);
  return slug;
}

/** Repositorio de contenido sobre los JSON embebidos en el build. */
export function createBundledGameContentRepository(): GameContentRepository {
  const bundle = async (gameId: ID) => loadRawBundle(await slugForGameId(gameId));
  return {
    async getGameBySlug(slug) {
      return (await loadRawBundle(slug)).game;
    },
    async getStages(gameId) {
      return (await bundle(gameId)).stages;
    },
    async getBranches(gameId) {
      return (await bundle(gameId)).branches;
    },
    async getParameters(gameId) {
      return (await bundle(gameId)).parameters;
    },
    async getCharacters(gameId) {
      return (await bundle(gameId)).characters;
    },
    async getPowers(gameId) {
      return (await bundle(gameId)).powers;
    },
    async getBadges(gameId) {
      return (await bundle(gameId)).badges;
    },
    async getIcons(gameId) {
      return (await bundle(gameId)).icons;
    },
    async getAssets(gameId) {
      return (await bundle(gameId)).assets;
    },
    async getAesthetic(aestheticId) {
      const entries = await listUniverses({ includeUnpublished: true });
      for (const entry of entries) {
        const bundle = await loadRawBundle(entry.slug);
        if (bundle.aesthetic?.id === aestheticId) return bundle.aesthetic;
      }
      return undefined;
    },
  };
}

/** Repositorio de cartas del bundle (sin estadísticas en este plan). */
export function createBundledCardRepository(): CardRepository {
  return {
    async getPublishedCards(gameId) {
      const bundle = await loadRawBundle(await slugForGameId(gameId));
      return bundle.cards.filter((c) => c.status === "published");
    },
    async getCardCounters(_gameId): Promise<(RawCardCounters & { cardId: ID })[]> {
      return [];
    },
  };
}

/**
 * Carga el contenido jugable de un universo. Lanza `UnknownUniverseError`
 * si el slug no existe o no está publicado (fuera de DEV/test). No valida.
 */
export async function loadGameContent(
  repo: GameContentRepository,
  cards: CardRepository,
  slug: string,
): Promise<GameContent> {
  const game = await repo.getGameBySlug(slug);
  if (!game) throw new UnknownUniverseError(slug);
  if (game.status !== "published" && !isDevOrTest()) throw new UnknownUniverseError(slug);
  const [stages, branches, parameters, characters, powers, badges, icons, assets, publishedCards, aesthetic] =
    await Promise.all([
      repo.getStages(game.id),
      repo.getBranches(game.id),
      repo.getParameters(game.id),
      repo.getCharacters(game.id),
      repo.getPowers(game.id),
      repo.getBadges(game.id),
      repo.getIcons(game.id),
      repo.getAssets(game.id),
      cards.getPublishedCards(game.id),
      repo.getAesthetic(game.aestheticId),
    ]);
  return assembleGameContent({
    game,
    stages,
    branches,
    parameters,
    characters,
    powers,
    badges,
    icons,
    assets,
    cards: publishedCards,
    aesthetic,
  });
}
