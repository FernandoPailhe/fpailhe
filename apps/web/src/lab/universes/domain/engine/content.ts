import type { ID, SituationCard } from "../models";
import { validateSituationCard } from "./validation";
import type { GameContent, RawGameBundle, ValidationIssue } from "./types";

/**
 * Arma el `GameContent` desde el bundle crudo: etapas ordenadas por `order`
 * y solo cartas `published`. **No** valida (eso es `validateGameContent`).
 */
export function assembleGameContent(raw: RawGameBundle): GameContent {
  return {
    game: raw.game,
    stages: [...raw.stages].sort((a, b) => a.order - b.order),
    branches: raw.branches,
    parameters: raw.parameters,
    characters: raw.characters,
    powers: raw.powers,
    badges: raw.badges,
    icons: raw.icons,
    assets: raw.assets,
    cards: raw.cards.filter((c) => c.status === "published"),
    aesthetic: raw.aesthetic,
  };
}

export interface MergeDropped {
  cardId: ID;
  reason: "duplicate" | "invalid";
  issues: ValidationIssue[];
}

/**
 * Agrega cartas extra (de usuarios): descarta duplicadas por id (gana la
 * existente), las no `published` y las inválidas (`validateSituationCard`
 * con algún `error`). Devuelve el contenido nuevo (inmutable) y lo descartado.
 */
export function mergeCards(
  content: GameContent,
  extra: readonly SituationCard[],
): { content: GameContent; dropped: MergeDropped[] } {
  const ids = new Set(content.cards.map((c) => c.id));
  const added: SituationCard[] = [];
  const dropped: MergeDropped[] = [];

  for (const card of extra) {
    if (ids.has(card.id)) {
      dropped.push({ cardId: card.id, reason: "duplicate", issues: [] });
      continue;
    }
    if (card.status !== "published") {
      dropped.push({
        cardId: card.id,
        reason: "invalid",
        issues: [
          {
            severity: "error",
            code: "E_CARD_STATUS",
            path: `cards[${card.id}].status`,
            message: `carta con status ${card.status}`,
          },
        ],
      });
      continue;
    }
    const issues = validateSituationCard(card, { ...content, cards: [...content.cards, ...added] });
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      dropped.push({ cardId: card.id, reason: "invalid", issues });
      continue;
    }
    added.push(card);
    ids.add(card.id);
  }

  if (added.length === 0) return { content, dropped };
  return { content: { ...content, cards: [...content.cards, ...added] }, dropped };
}
