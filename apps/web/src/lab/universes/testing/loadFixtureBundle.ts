import type { RawGameBundle } from "../domain/engine/types";

const topFiles = import.meta.glob("./fixtures/demo-reino/*.json", {
  eager: true,
  import: "default",
});
const cardFiles = import.meta.glob("./fixtures/demo-reino/cards/*.json", {
  eager: true,
  import: "default",
});

/** Carga sincrónica del fixture `demo-reino` (solo para tests). */
export function loadFixtureBundle(): RawGameBundle {
  const read = <T>(name: string): T | undefined =>
    topFiles[`./fixtures/demo-reino/${name}.json`] as T | undefined;
  const cards = Object.values(cardFiles);
  const bundle = {
    game: read("game"),
    stages: read("stages"),
    parameters: read("parameters"),
    branches: read("branches") ?? [],
    characters: read("characters") ?? [],
    powers: read("powers") ?? [],
    badges: read("badges") ?? [],
    icons: read("icons") ?? [],
    assets: read("assets") ?? [],
    cards,
    aesthetic: read("aesthetic"),
  };
  // Cast en el borde: los JSON no pueden comprobarse con `satisfies`.
  return bundle as unknown as RawGameBundle;
}
