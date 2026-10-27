import type { Game, LocalizedText } from "./models";

/** Finales del juego, referenciados por `end_game.endingKey`. Viven en `Game.metadata.endings`. */
export interface EndingText {
  title: LocalizedText;
  text: LocalizedText;
}
export interface GameEndingsMeta {
  endings: Record<string, EndingText>;
}

/** Texto del final; undefined si el juego no lo define (la UI usa un genérico por outcome). */
export function endingFor(game: Game, endingKey: string | undefined): EndingText | undefined {
  const endings = (game.metadata as Partial<GameEndingsMeta> | undefined)?.endings;
  return endingKey && endings ? endings[endingKey] : undefined;
}
