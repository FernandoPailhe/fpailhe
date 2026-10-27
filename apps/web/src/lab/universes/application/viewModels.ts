import { endingFor } from "../domain/extensions";
import { evaluateCondition } from "../domain/engine/conditions";
import { localize } from "../domain/engine/localize";
import { listOptions } from "../domain/engine/options";
import { getThresholdRisk } from "../domain/engine/risk";
import type { GameContent, GameEvent } from "../domain/engine/types";
import type {
  GameSession,
  Icon,
  ID,
  LocaleCode,
  SituationCard,
} from "../domain/models";
import { copy } from "./lib/copy";
import type {
  CardView,
  EndView,
  EventView,
  IconView,
  MediaView,
  OptionView,
  OutcomeView,
  ParameterView,
  PowerView,
  SpeakerView,
  StageView,
  ThemeInput,
} from "./types";

/** Solo activos, en el orden de `content.parameters` (nombres en `session.locale`). */
export function buildParameterViews(
  content: GameContent,
  session: GameSession,
  parametersBefore?: Record<ID, number>,
): ParameterView[] {
  const views: ParameterView[] = [];
  for (const p of content.parameters) {
    if (!session.activeParameterIds.includes(p.id)) continue;
    const value = session.parameters[p.id] ?? p.initialValue;
    const range = p.max - p.min;
    const before = parametersBefore?.[p.id];
    const delta = before !== undefined && before !== value ? value - before : null;
    views.push({
      id: p.id,
      key: p.key,
      name: localize(p.name, session.locale),
      iconId: p.iconId,
      value,
      min: p.min,
      max: p.max,
      ratio: range > 0 ? (value - p.min) / range : 0,
      delta,
      risk: getThresholdRisk(p, value),
    });
  }
  return views;
}

export function buildPowerViews(
  content: GameContent,
  session: GameSession,
  locale: LocaleCode,
): PowerView[] {
  const views: PowerView[] = [];
  for (const owned of session.powers) {
    const power = content.powers.find((p) => p.id === owned.powerId);
    if (!power) continue;
    views.push({
      id: power.id,
      name: localize(power.name, locale),
      kind: power.kind,
      charges: owned.charges,
      maxCharges: power.maxCharges,
      iconId: power.iconId,
    });
  }
  return views;
}

export function buildStageView(
  content: GameContent,
  session: GameSession,
  locale: LocaleCode,
): StageView | undefined {
  const stage = content.stages.find((s) => s.id === session.stageId);
  if (!stage) return undefined;
  return {
    id: stage.id,
    order: stage.order,
    name: localize(stage.name, locale),
    total: content.stages.length,
  };
}

function lockedReason(
  option: SituationCard["options"][number],
  content: GameContent,
  locale: LocaleCode,
): string {
  const availability = option.availability;
  if (availability?.type === "has_power") {
    const power = content.powers.find((p) => p.id === availability.powerId);
    if (power) return copy.requiresPower(localize(power.name, locale));
  }
  if (option.unlockTag) {
    const power = content.powers.find(
      (p) => p.kind === "option_unlock" && p.unlocksOptionTag === option.unlockTag,
    );
    if (power) return copy.requiresPower(localize(power.name, locale));
  }
  return copy.lockedGeneric;
}

export function buildCardView(
  card: SituationCard,
  content: GameContent,
  session: GameSession,
  locale: LocaleCode,
): CardView {
  let media: MediaView | undefined;
  if (card.assetId) {
    const asset = content.assets.find((a) => a.id === card.assetId);
    if (asset) {
      media = {
        type: asset.type,
        url: asset.url,
        posterUrl: asset.posterUrl,
        alt: localize(asset.altText, locale),
      };
    }
  }

  let speaker: SpeakerView | undefined;
  if (card.characterId) {
    const character = content.characters.find((c) => c.id === card.characterId);
    if (character) {
      const portrait = character.portraitAssetId
        ? content.assets.find((a) => a.id === character.portraitAssetId)
        : undefined;
      speaker = {
        name: localize(character.name, locale),
        title: character.title ? localize(character.title, locale) : undefined,
        portraitUrl: portrait?.url,
        portraitAlt: portrait ? localize(portrait.altText, locale) : undefined,
      };
    }
  }

  const options: OptionView[] = listOptions(card, session, content).map((s) => ({
    id: s.option.id,
    order: s.option.order,
    label: localize(s.option.label, locale),
    kind: s.option.kind,
    state: s.state,
    lockedReason: s.state === "locked" ? lockedReason(s.option, content, locale) : undefined,
  }));

  return {
    id: card.id,
    text: localize(card.text, locale),
    difficulty: card.difficulty,
    media,
    speaker,
    options,
  };
}

function entityName(
  list: { id: ID; name: { default: string } | undefined }[],
  id: ID,
  locale: LocaleCode,
): string {
  const found = list.find((x) => x.id === id);
  return found?.name ? localize(found.name, locale) : id;
}

function eventView(
  e: GameEvent,
  content: GameContent,
  locale: LocaleCode,
): EventView | null {
  switch (e.type) {
    case "parameter_changed": {
      const name = entityName(content.parameters, e.parameterId, locale);
      return {
        type: e.type,
        tone: e.delta > 0 ? "gain" : e.delta < 0 ? "loss" : "neutral",
        text: copy.paramDelta(name, e.delta),
        parameterId: e.parameterId,
        delta: e.delta,
      };
    }
    case "score_changed": {
      const delta = e.to - e.from;
      return {
        type: e.type,
        tone: delta > 0 ? "gain" : delta < 0 ? "loss" : "neutral",
        text: copy.scoreDelta(delta),
        delta,
      };
    }
    case "shield_used":
      return {
        type: e.type,
        tone: "gain",
        text: copy.shieldUsed(entityName(content.powers, e.powerId, locale)),
      };
    case "threshold_fired":
      return {
        type: e.type,
        tone: "loss",
        text: copy.thresholdFired(entityName(content.parameters, e.parameterId, locale)),
        parameterId: e.parameterId,
      };
    case "power_granted":
      return {
        type: e.type,
        tone: "gain",
        text: copy.powerGranted(entityName(content.powers, e.powerId, locale), e.charges),
      };
    case "power_consumed":
      return {
        type: e.type,
        tone: "neutral",
        text: copy.powerConsumed(entityName(content.powers, e.powerId, locale)),
      };
    case "badge_awarded":
      return {
        type: e.type,
        tone: "gain",
        text: copy.badgeAwarded(entityName(content.badges, e.badgeId, locale)),
      };
    case "stage_advanced":
      return {
        type: e.type,
        tone: "gain",
        text: copy.stageAdvanced(entityName(content.stages, e.stageId, locale)),
      };
    case "branch_entered":
      return {
        type: e.type,
        tone: "neutral",
        text: copy.branchEntered(entityName(content.branches, e.branchId, locale)),
      };
    case "branch_left":
      return {
        type: e.type,
        tone: "neutral",
        text: copy.branchLeft(entityName(content.branches, e.branchId, locale)),
      };
    case "character_unlocked":
      return {
        type: e.type,
        tone: "neutral",
        text: copy.characterUnlocked(entityName(content.characters, e.characterId, locale)),
      };
    case "character_locked":
      return {
        type: e.type,
        tone: "neutral",
        text: copy.characterLocked(entityName(content.characters, e.characterId, locale)),
      };
    case "parameter_activated":
      return {
        type: e.type,
        tone: "neutral",
        text: copy.parameterActivated(entityName(content.parameters, e.parameterId, locale)),
        parameterId: e.parameterId,
      };
    case "parameter_deactivated":
      return {
        type: e.type,
        tone: "neutral",
        text: copy.parameterDeactivated(entityName(content.parameters, e.parameterId, locale)),
        parameterId: e.parameterId,
      };
    case "card_enqueued":
    case "cascade_limit_reached":
    case "game_ended":
      return null;
  }
}

export function buildOutcomeView(
  card: SituationCard,
  optionId: ID,
  events: GameEvent[],
  session: GameSession,
  content: GameContent,
  locale: LocaleCode,
): OutcomeView {
  const option = card.options.find((o) => o.id === optionId);
  return {
    chosenLabel: option ? localize(option.label, locale) : "",
    outcomeText: option?.outcomeText ? localize(option.outcomeText, locale) : undefined,
    events: events.map((e) => eventView(e, content, locale)).filter((v): v is EventView => !!v),
    ended: session.status !== "active",
    result:
      session.status === "won" ? "victory" : session.status === "lost" ? "defeat" : undefined,
  };
}

export function buildEndView(
  content: GameContent,
  session: GameSession,
  locale: LocaleCode,
): EndView {
  const result =
    session.status === "won" ? "victory" : session.status === "lost" ? "defeat" : "abandoned";
  const ending = endingFor(content.game, session.endingKey);
  const stage = content.stages.find((s) => s.id === session.stageId);
  return {
    result,
    title: ending ? localize(ending.title, locale) : copy.endTitle(result),
    text: ending ? localize(ending.text, locale) : copy.endText(result),
    turns: session.turn,
    score: session.score,
    stageName: stage ? localize(stage.name, locale) : "",
    badges: session.earnedBadgeIds
      .map((id) => {
        const badge = content.badges.find((b) => b.id === id);
        return badge ? { id: badge.id, name: localize(badge.name, locale), iconId: badge.iconId } : undefined;
      })
      .filter((b): b is NonNullable<typeof b> => !!b),
    parameters: buildParameterViews(content, session),
  };
}

export function buildIconViews(content: GameContent, locale: LocaleCode): Record<ID, IconView> {
  const out: Record<ID, IconView> = {};
  for (const icon of content.icons as Icon[]) {
    out[icon.id] = {
      svg: icon.svg,
      label: localize(icon.label, locale),
      semanticTags: icon.semanticTags,
    };
  }
  return out;
}

export function buildThemeInput(content: GameContent, session: GameSession | null): ThemeInput {
  const aesthetic = content.aesthetic;
  if (!aesthetic || !session) return { aesthetic, activeOverrides: [] };
  const activeOverrides = (aesthetic.overrides ?? []).filter((o) => {
    try {
      return evaluateCondition(o.when, session, content);
    } catch {
      return false; // una condición inválida nunca rompe la partida
    }
  });
  return { aesthetic, activeOverrides };
}
