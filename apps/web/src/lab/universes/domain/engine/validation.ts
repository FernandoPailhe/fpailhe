import { ID_PATTERN, OFFICIAL_ID_PREFIX, USER_ID_PREFIX } from "../constants";
import type {
  Condition,
  DecisionOption,
  Effect,
  ID,
  LocalizedText,
  SituationCard,
} from "../models";
import type { GameContent, ValidationIssue } from "./types";

interface RefSets {
  stages: Set<ID>;
  branches: Set<ID>;
  parameters: Set<ID>;
  characters: Set<ID>;
  powers: Set<ID>;
  badges: Set<ID>;
  icons: Set<ID>;
  assets: Set<ID>;
  cards: Set<ID>;
  aestheticId?: ID;
}

type Sink = (issue: ValidationIssue) => void;

function ref(sink: Sink, set: Set<ID>, id: ID | undefined, path: string, what: string): void {
  if (id === undefined) return;
  if (!set.has(id)) {
    sink({ severity: "error", code: "E_REF_MISSING", path, message: `${what} inexistente: ${id}` });
  }
}

function checkId(sink: Sink, id: ID, path: string, official: boolean): void {
  if (!ID_PATTERN.test(id)) {
    sink({ severity: "error", code: "E_ID_CHARS", path, message: `id inválido: "${id}"` });
  }
  if (official && !id.startsWith(OFFICIAL_ID_PREFIX)) {
    sink({ severity: "error", code: "E_ID_PREFIX", path, message: `id oficial sin prefijo off_: "${id}"` });
  }
}

function checkText(sink: Sink, text: LocalizedText | undefined, path: string): void {
  if (!text || text.default.trim() === "") {
    sink({ severity: "error", code: "E_TEXT_EMPTY", path, message: "LocalizedText.default vacío" });
  }
}

function checkCondition(sink: Sink, condition: Condition | undefined, sets: RefSets, path: string): void {
  if (!condition) return;
  switch (condition.type) {
    case "all":
    case "any":
      condition.conditions.forEach((c, i) => checkCondition(sink, c, sets, `${path}.conditions[${i}]`));
      return;
    case "not":
      checkCondition(sink, condition.condition, sets, `${path}.condition`);
      return;
    case "parameter":
      ref(sink, sets.parameters, condition.parameterId, path, "parameterId");
      return;
    case "in_branch":
      ref(sink, sets.branches, condition.branchId, path, "branchId");
      return;
    case "has_power":
      ref(sink, sets.powers, condition.powerId, path, "powerId");
      return;
    case "character_unlocked":
      ref(sink, sets.characters, condition.characterId, path, "characterId");
      return;
    case "card_seen":
      ref(sink, sets.cards, condition.cardId, path, "cardId");
      return;
    case "score":
    case "stage_at_least":
    case "has_flag":
    case "turn":
      return;
    default: {
      const exhaustive: never = condition;
      return exhaustive;
    }
  }
}

function checkEffect(sink: Sink, effect: Effect, sets: RefSets, path: string): void {
  switch (effect.type) {
    case "modify_parameter":
    case "set_parameter":
    case "activate_parameter":
    case "deactivate_parameter":
      ref(sink, sets.parameters, effect.parameterId, path, "parameterId");
      return;
    case "enter_branch":
    case "leave_branch":
      ref(sink, sets.branches, effect.branchId, path, "branchId");
      return;
    case "unlock_character":
    case "lock_character":
      ref(sink, sets.characters, effect.characterId, path, "characterId");
      return;
    case "grant_power":
    case "consume_power":
      ref(sink, sets.powers, effect.powerId, path, "powerId");
      return;
    case "award_badge":
      ref(sink, sets.badges, effect.badgeId, path, "badgeId");
      return;
    case "enqueue_card":
      ref(sink, sets.cards, effect.cardId, path, "cardId");
      return;
    case "add_score":
    case "set_flag":
    case "end_game":
      return;
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

function checkEffects(sink: Sink, effects: readonly Effect[] | undefined, sets: RefSets, path: string): void {
  effects?.forEach((e, i) => checkEffect(sink, e, sets, `${path}.effects[${i}]`));
}

function checkOption(sink: Sink, option: DecisionOption, sets: RefSets, path: string): void {
  checkId(sink, option.id, `${path}.id`, false);
  checkText(sink, option.label, `${path}.label`);
  checkCondition(sink, option.availability, sets, `${path}.availability`);
  checkEffects(sink, option.effects, sets, path);
  if (option.kind === "balance" && !option.availability && !option.unlockTag) {
    sink({
      severity: "warning",
      code: "W_BALANCE_UNGATED",
      path,
      message: "opción balance sin availability ni unlockTag: siempre disponible",
    });
  }
}

function checkCard(sink: Sink, card: SituationCard, sets: RefSets, path: string): void {
  checkId(sink, card.id, `${path}.id`, card.origin === "official");
  if (card.origin === "community") {
    if (!card.id.startsWith(USER_ID_PREFIX)) {
      sink({
        severity: "error",
        code: "E_ID_PREFIX",
        path: `${path}.id`,
        message: `carta de usuarios sin prefijo usr_: "${card.id}"`,
      });
    }
    if (!card.createdBy) {
      sink({
        severity: "error",
        code: "E_ID_PREFIX",
        path: `${path}.createdBy`,
        message: "carta de usuarios sin createdBy",
      });
    }
  }
  checkText(sink, card.text, `${path}.text`);

  if (!Number.isInteger(card.difficulty) || card.difficulty < 1 || card.difficulty > 10) {
    sink({
      severity: "error",
      code: "E_DIFFICULTY",
      path: `${path}.difficulty`,
      message: `difficulty debe ser entero 1..10: ${card.difficulty}`,
    });
  }

  if (card.options.length < 1 || card.options.length > 3) {
    sink({
      severity: "error",
      code: "E_OPTIONS_COUNT",
      path: `${path}.options`,
      message: `options.length fuera de 1..3: ${card.options.length}`,
    });
  }
  const optionIds = new Set<ID>();
  const orders = new Set<number>();
  let balanceCount = 0;
  card.options.forEach((option, i) => {
    if (optionIds.has(option.id)) {
      sink({ severity: "error", code: "E_DUP_ID", path: `${path}.options[${i}].id`, message: `option.id repetido: ${option.id}` });
    }
    optionIds.add(option.id);
    if (orders.has(option.order)) {
      sink({ severity: "error", code: "E_OPTION_ORDER", path: `${path}.options[${i}].order`, message: `order repetido: ${option.order}` });
    }
    orders.add(option.order);
    if (option.kind === "balance") balanceCount += 1;
    checkOption(sink, option, sets, `${path}.options[${i}]`);
  });
  if (balanceCount > 1) {
    sink({
      severity: "error",
      code: "E_MULTI_BALANCE",
      path: `${path}.options`,
      message: `más de una opción balance: ${balanceCount}`,
    });
  }

  card.availability.branchIds?.forEach((b, i) =>
    ref(sink, sets.branches, b, `${path}.availability.branchIds[${i}]`, "branchId"),
  );
  checkCondition(sink, card.availability.conditions, sets, `${path}.availability.conditions`);
  ref(sink, sets.assets, card.assetId, `${path}.assetId`, "assetId");
  ref(sink, sets.characters, card.characterId, `${path}.characterId`, "characterId");
}

function refSets(content: GameContent): RefSets {
  return {
    stages: new Set(content.stages.map((s) => s.id)),
    branches: new Set(content.branches.map((b) => b.id)),
    parameters: new Set(content.parameters.map((p) => p.id)),
    characters: new Set(content.characters.map((c) => c.id)),
    powers: new Set(content.powers.map((p) => p.id)),
    badges: new Set(content.badges.map((b) => b.id)),
    icons: new Set(content.icons.map((i) => i.id)),
    assets: new Set(content.assets.map((a) => a.id)),
    cards: new Set(content.cards.map((c) => c.id)),
    aestheticId: content.aesthetic?.id,
  };
}

function dupCheck(sink: Sink, ids: readonly ID[], collection: string): void {
  const seen = new Set<ID>();
  for (const id of ids) {
    if (seen.has(id)) {
      sink({ severity: "error", code: "E_DUP_ID", path: `${collection}[${id}]`, message: `id repetido en ${collection}: ${id}` });
    }
    seen.add(id);
  }
}

/** Reglas a nivel carta contra un contenido (sirve para cartas de usuarios). */
export function validateSituationCard(card: SituationCard, content: GameContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sink: Sink = (i) => issues.push(i);
  const sets = { ...refSets(content), cards: new Set([...content.cards.map((c) => c.id), card.id]) };
  const path = `cards[${card.id}]`;
  if (card.gameId !== content.game.id) {
    sink({
      severity: "error",
      code: "E_GAME_MISMATCH",
      path: `${path}.gameId`,
      message: `card.gameId ${card.gameId} ≠ game.id ${content.game.id}`,
    });
  }
  checkCard(sink, card, sets, path);
  return issues;
}

/** Una pasada de validación del contenido oficial completo (spec §3.1). */
export function validateGameContent(content: GameContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sink: Sink = (i) => issues.push(i);
  const sets = refSets(content);
  const { game } = content;

  checkId(sink, game.id, "game.id", true);
  checkText(sink, game.title, "game.title");
  checkText(sink, game.description, "game.description");
  if (sets.aestheticId !== undefined && game.aestheticId !== sets.aestheticId) {
    sink({
      severity: "error",
      code: "E_REF_MISSING",
      path: "game.aestheticId",
      message: `game.aestheticId ${game.aestheticId} ≠ aesthetic.id ${sets.aestheticId}`,
    });
  }

  // Duplicados por colección
  dupCheck(sink, content.stages.map((s) => s.id), "stages");
  dupCheck(sink, content.branches.map((b) => b.id), "branches");
  dupCheck(sink, content.parameters.map((p) => p.id), "parameters");
  dupCheck(sink, content.characters.map((c) => c.id), "characters");
  dupCheck(sink, content.powers.map((p) => p.id), "powers");
  dupCheck(sink, content.badges.map((b) => b.id), "badges");
  dupCheck(sink, content.icons.map((i) => i.id), "icons");
  dupCheck(sink, content.assets.map((a) => a.id), "assets");
  dupCheck(sink, content.cards.map((c) => c.id), "cards");

  // Stages
  if (content.stages.length === 0) {
    sink({ severity: "error", code: "E_STAGE_ORDER", path: "stages", message: "el juego no tiene etapas" });
  }
  const stageOrders = new Set<number>();
  for (const stage of content.stages) {
    const path = `stages[${stage.id}]`;
    checkId(sink, stage.id, `${path}.id`, true);
    if (stage.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    if (stageOrders.has(stage.order)) {
      sink({ severity: "error", code: "E_STAGE_ORDER", path: `${path}.order`, message: `order repetido: ${stage.order}` });
    }
    stageOrders.add(stage.order);
    checkText(sink, stage.name, `${path}.name`);
    const { min, max } = stage.difficultyRange;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 10 || min > max) {
      sink({ severity: "error", code: "E_DIFFICULTY", path: `${path}.difficultyRange`, message: `difficultyRange inválido: ${min}..${max}` });
    }
    stage.activatesParameterIds?.forEach((id, i) =>
      ref(sink, sets.parameters, id, `${path}.activatesParameterIds[${i}]`, "parameterId"),
    );
    checkCondition(sink, stage.enterConditions, sets, `${path}.enterConditions`);
    checkEffects(sink, stage.onEnter, sets, path);
  }

  // Branches
  for (const branch of content.branches) {
    const path = `branches[${branch.id}]`;
    checkId(sink, branch.id, `${path}.id`, true);
    if (branch.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    checkText(sink, branch.name, `${path}.name`);
  }

  // Parameters (+ thresholds únicos en todo el juego)
  const thresholdIds = new Set<ID>();
  const activatedSomewhere = new Set<ID>(game.config.initialActiveParameterIds);
  for (const stage of content.stages) {
    stage.activatesParameterIds?.forEach((id) => activatedSomewhere.add(id));
  }
  const collectActivations = (effects: readonly Effect[] | undefined) =>
    effects?.forEach((e) => {
      if (e.type === "activate_parameter") activatedSomewhere.add(e.parameterId);
    });
  for (const param of content.parameters) {
    const path = `parameters[${param.id}]`;
    checkId(sink, param.id, `${path}.id`, true);
    if (param.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    checkText(sink, param.name, `${path}.name`);
    if (param.min >= param.max || param.initialValue < param.min || param.initialValue > param.max) {
      sink({
        severity: "error",
        code: "E_PARAM_RANGE",
        path,
        message: `rango/initial inválido: ${param.min}..${param.max}, initial ${param.initialValue}`,
      });
    }
    if (!param.iconId) {
      sink({ severity: "warning", code: "W_NO_ICON", path: `${path}.iconId`, message: "parámetro sin iconId" });
    } else {
      ref(sink, sets.icons, param.iconId, `${path}.iconId`, "iconId");
    }
    param.thresholds.forEach((threshold, i) => {
      const tpath = `${path}.thresholds[${i}]`;
      if (thresholdIds.has(threshold.id)) {
        sink({ severity: "error", code: "E_DUP_ID", path: `${tpath}.id`, message: `threshold.id repetido: ${threshold.id}` });
      }
      thresholdIds.add(threshold.id);
      checkId(sink, threshold.id, `${tpath}.id`, true);
      if (threshold.value < param.min || threshold.value > param.max) {
        sink({ severity: "warning", code: "W_THRESHOLD_RANGE", path: `${tpath}.value`, message: `threshold.value fuera de [${param.min},${param.max}]` });
      }
      if (!threshold.once && !threshold.effects.some((e) => e.type === "end_game")) {
        sink({
          severity: "warning",
          code: "W_THRESHOLD_NO_END",
          path: tpath,
          message: "threshold sin once y sin end_game: se re-dispara cada turno",
        });
      }
      checkEffects(sink, threshold.effects, sets, tpath);
      collectActivations(threshold.effects);
    });
  }

  // Characters
  for (const character of content.characters) {
    const path = `characters[${character.id}]`;
    checkId(sink, character.id, `${path}.id`, true);
    if (character.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    checkText(sink, character.name, `${path}.name`);
    ref(sink, sets.assets, character.portraitAssetId, `${path}.portraitAssetId`, "assetId");
    checkCondition(sink, character.unlockCondition, sets, `${path}.unlockCondition`);
  }

  // Powers
  for (const power of content.powers) {
    const path = `powers[${power.id}]`;
    checkId(sink, power.id, `${path}.id`, true);
    if (power.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    checkText(sink, power.name, `${path}.name`);
    if (!power.iconId) {
      sink({ severity: "warning", code: "W_NO_ICON", path: `${path}.iconId`, message: "poder sin iconId" });
    } else {
      ref(sink, sets.icons, power.iconId, `${path}.iconId`, "iconId");
    }
    if (power.kind === "modifier" && power.parameterId !== undefined) {
      ref(sink, sets.parameters, power.parameterId, `${path}.parameterId`, "parameterId");
    }
  }

  // Badges
  for (const badge of content.badges) {
    const path = `badges[${badge.id}]`;
    checkId(sink, badge.id, `${path}.id`, true);
    if (badge.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    checkText(sink, badge.name, `${path}.name`);
    if (!badge.iconId) {
      sink({ severity: "warning", code: "W_NO_ICON", path: `${path}.iconId`, message: "insignia sin iconId" });
    } else {
      ref(sink, sets.icons, badge.iconId, `${path}.iconId`, "iconId");
    }
  }

  // Icons
  for (const icon of content.icons) {
    const path = `icons[${icon.id}]`;
    checkId(sink, icon.id, `${path}.id`, true);
    if (icon.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    checkText(sink, icon.label, `${path}.label`);
    ref(sink, sets.assets, icon.assetId, `${path}.assetId`, "assetId");
  }

  // Assets
  for (const asset of content.assets) {
    const path = `assets[${asset.id}]`;
    checkId(sink, asset.id, `${path}.id`, true);
    if (asset.gameId !== undefined && asset.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
  }

  // Aesthetic (overrides con condiciones referencian ramas/etapas)
  if (content.aesthetic) {
    const path = `aesthetic[${content.aesthetic.id}]`;
    checkId(sink, content.aesthetic.id, `${path}.id`, true);
    content.aesthetic.overrides?.forEach((override, i) =>
      checkCondition(sink, override.when, sets, `${path}.overrides[${i}].when`),
    );
  }

  // Cards
  for (const card of content.cards) {
    const path = `cards[${card.id}]`;
    if (card.status !== "published") {
      sink({
        severity: "error",
        code: "E_CARD_STATUS",
        path: `${path}.status`,
        message: `carta en el mazo con status ${card.status}`,
      });
    }
    if (card.gameId !== game.id) {
      sink({ severity: "error", code: "E_GAME_MISMATCH", path: `${path}.gameId`, message: "gameId ≠ game.id" });
    }
    checkCard(sink, card, sets, path);
  }

  // GameConfig
  game.config.initialActiveParameterIds.forEach((id, i) =>
    ref(sink, sets.parameters, id, `game.config.initialActiveParameterIds[${i}]`, "parameterId"),
  );
  if (game.config.initialActiveParameterIds.length === 0) {
    sink({
      severity: "error",
      code: "E_INITIAL_ACTIVE",
      path: "game.config.initialActiveParameterIds",
      message: "sin parámetros activos iniciales",
    });
  } else {
    const missing = game.config.initialActiveParameterIds.filter((id) => !sets.parameters.has(id));
    if (missing.length > 0) {
      sink({
        severity: "error",
        code: "E_INITIAL_ACTIVE",
        path: "game.config.initialActiveParameterIds",
        message: `ids inexistentes: ${missing.join(", ")}`,
      });
    }
  }
  game.config.initialUnlockedCharacterIds.forEach((id, i) =>
    ref(sink, sets.characters, id, `game.config.initialUnlockedCharacterIds[${i}]`, "characterId"),
  );
  game.config.initialBranchIds.forEach((id, i) =>
    ref(sink, sets.branches, id, `game.config.initialBranchIds[${i}]`, "branchId"),
  );
  game.config.initialPowers?.forEach((p, i) =>
    ref(sink, sets.powers, p.powerId, `game.config.initialPowers[${i}].powerId`, "powerId"),
  );

  // Efectos sueltos que pueden activar parámetros (cartas y etapas)
  for (const stage of content.stages) collectActivations(stage.onEnter);
  for (const card of content.cards) {
    for (const option of card.options) collectActivations(option.effects);
  }
  for (const param of content.parameters) {
    if (!activatedSomewhere.has(param.id)) {
      sink({
        severity: "warning",
        code: "W_PARAM_NEVER_ACTIVE",
        path: `parameters[${param.id}]`,
        message: "parámetro que nunca se activa",
      });
    }
  }

  return issues;
}
