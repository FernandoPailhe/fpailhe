import type { GameSession, SituationCard } from "../models";
import { evaluateCondition } from "./conditions";
import type { GameContent, OptionState } from "./types";

/**
 * Regla 10 del plan: una opción es `available` si su `availability` evalúa
 * true y, si tiene `unlockTag`, el jugador posee un `option_unlock` con ese
 * tag y `charges >= 1`. No disponible + `hide` ⇒ no aparece; `show_locked`
 * ⇒ aparece como `locked`. Ordenadas por `order`.
 */
export function listOptions(
  card: SituationCard,
  session: GameSession,
  content: GameContent,
): OptionState[] {
  const unlockerTags = new Set(
    session.powers
      .filter((owned) => owned.charges >= 1)
      .map((owned) => content.powers.find((p) => p.id === owned.powerId))
      .filter((p) => p?.kind === "option_unlock")
      .map((p) => (p?.kind === "option_unlock" ? p.unlocksOptionTag : "")),
  );

  const states: OptionState[] = [];
  for (const option of [...card.options].sort((a, b) => a.order - b.order)) {
    const availabilityOk = evaluateCondition(option.availability, session, content);
    const unlockOk = option.unlockTag === undefined || unlockerTags.has(option.unlockTag);
    if (availabilityOk && unlockOk) {
      states.push({ option, state: "available" });
    } else if (option.whenUnavailable === "show_locked") {
      states.push({ option, state: "locked" });
    }
    // `hide`: no aparece
  }
  return states;
}
