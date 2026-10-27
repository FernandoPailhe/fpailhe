import { describe, expect, it } from "vitest";
import type { Parameter } from "../models";
import type { GameContent } from "./types";
import { validateGameContent, validateSituationCard } from "./validation";
import { makeCard, makeContent, makeOption, makeStage } from "./testing";

const T0 = "2026-01-01T00:00:00.000Z";

function param(id: string, overrides: Partial<Parameter> = {}): Parameter {
  return {
    id,
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: id,
    name: { default: id },
    iconId: "off_icon_x",
    min: 0,
    max: 100,
    initialValue: 50,
    thresholds: [],
    ...overrides,
  };
}

/** Contenido mínimo válido: una etapa, un parámetro activo, una carta. */
function validContent(): GameContent {
  const content = makeContent({
    stages: [makeStage({ id: "off_stage_1", order: 1, difficultyRange: { min: 1, max: 10 } })],
    parameters: [param("off_param_p1")],
    icons: [
      {
        id: "off_icon_x",
        gameId: "off_game_test",
        schemaVersion: 1,
        createdAt: T0,
        updatedAt: T0,
        key: "x",
        label: { default: "X" },
        semanticTags: [],
      },
    ],
    cards: [
      makeCard({
        id: "off_card_a",
        options: [
          makeOption({ id: "o1", effects: [{ type: "modify_parameter", parameterId: "off_param_p1", delta: 1 }] }),
        ],
      }),
    ],
  });
  content.game = {
    ...content.game,
    id: "off_game_test",
    aestheticId: "off_aesthetic_test",
    config: {
      recentCardsWindow: 3,
      initialActiveParameterIds: ["off_param_p1"],
      initialUnlockedCharacterIds: [],
      initialBranchIds: [],
      allowCardFeedback: false,
    },
  };
  content.aesthetic = {
    id: "off_aesthetic_test",
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: "a",
    name: { default: "A" },
    version: 1,
    artDirection: {
      styleSummary: "s",
      basePrompt: "b",
      negativePrompt: "n",
      keywords: [],
      mood: [],
      paletteHint: "p",
      templates: {},
    },
    tokens: {
      defaultScheme: "dark",
      radius: { sm: 2, md: 4, lg: 8 },
      borderWidth: 1,
      spacingUnit: 4,
      motion: { durationFast: 100, durationBase: 200, durationSlow: 400, easing: "ease", cardTransition: "fade" },
    },
    typography: {
      fonts: {
        display: { family: "F", source: "system", weights: [400], fallback: ["sans-serif"] },
        body: { family: "F", source: "system", weights: [400], fallback: ["sans-serif"] },
      },
      scale: {
        title: { font: "display", size: 24, lineHeight: 1.2, weight: 700 },
        cardText: { font: "body", size: 16, lineHeight: 1.5, weight: 400 },
        option: { font: "body", size: 16, lineHeight: 1.4, weight: 500 },
        label: { font: "body", size: 12, lineHeight: 1.3, weight: 500 },
        number: { font: "body", size: 14, lineHeight: 1.2, weight: 600 },
        caption: { font: "body", size: 11, lineHeight: 1.3, weight: 400 },
      },
    },
    iconStyle: { variant: "line", gridSize: 24, format: "svg", colorMode: "currentColor" },
  };
  return content;
}

const errors = (content: GameContent) =>
  validateGameContent(content).filter((i) => i.severity === "error");

function expectCode(content: GameContent, code: string, pathPart?: string) {
  const issues = errors(content).filter((i) => i.code === code);
  expect(issues.length, `esperaba ${code}`).toBeGreaterThan(0);
  if (pathPart) expect(issues.some((i) => i.path.includes(pathPart))).toBe(true);
}

describe("validateGameContent — contenido válido", () => {
  it("no produce errores", () => {
    expect(errors(validContent())).toEqual([]);
  });
});

describe("validateGameContent — errores E_*", () => {
  it("E_DUP_ID: ids repetidos en una colección y en opciones", () => {
    const content = validContent();
    content.parameters.push(param("off_param_p1"));
    expectCode(content, "E_DUP_ID", "parameters[off_param_p1]");

    const content2 = validContent();
    content2.cards[0]!.options.push(makeOption({ id: "o1", order: 2 }));
    expectCode(content2, "E_DUP_ID", "options");
  });

  it("E_ID_CHARS: id con caracteres inválidos", () => {
    const content = validContent();
    content.parameters[0]!.id = "mal id!";
    content.game.config.initialActiveParameterIds = ["mal id!"];
    expectCode(content, "E_ID_CHARS", "parameters[mal id!].id");
  });

  it("E_ID_PREFIX: entidad oficial sin off_", () => {
    const content = validContent();
    content.cards[0]!.id = "card_sin_prefijo";
    expectCode(content, "E_ID_PREFIX", "cards[card_sin_prefijo].id");
  });

  it("E_GAME_MISMATCH: entity.gameId ≠ game.id", () => {
    const content = validContent();
    content.stages[0]!.gameId = "otro_juego";
    expectCode(content, "E_GAME_MISMATCH", "stages[off_stage_1].gameId");
  });

  it("E_REF_MISSING: referencias inexistentes en config, efectos y carta", () => {
    const content = validContent();
    content.game.config.initialActiveParameterIds = ["off_param_fantasma"];
    expectCode(content, "E_REF_MISSING", "initialActiveParameterIds");

    const content2 = validContent();
    content2.cards[0]!.assetId = "off_asset_fantasma";
    expectCode(content2, "E_REF_MISSING", "cards[off_card_a].assetId");

    const content3 = validContent();
    content3.stages[0]!.activatesParameterIds = ["off_param_fantasma"];
    expectCode(content3, "E_REF_MISSING", "activatesParameterIds");

    const content4 = validContent();
    content4.cards[0]!.availability.conditions = { type: "in_branch", branchId: "off_branch_x" };
    expectCode(content4, "E_REF_MISSING", "availability.conditions");
  });

  it("E_OPTIONS_COUNT: 0 o 4 opciones", () => {
    const content = validContent();
    content.cards[0]!.options = [];
    expectCode(content, "E_OPTIONS_COUNT");

    const content2 = validContent();
    content2.cards[0]!.options = [1, 2, 3, 4].map((n) => makeOption({ id: `o${n}`, order: n }));
    expectCode(content2, "E_OPTIONS_COUNT");
  });

  it("E_OPTION_ORDER: order repetido", () => {
    const content = validContent();
    content.cards[0]!.options = [
      makeOption({ id: "o1", order: 1 }),
      makeOption({ id: "o2", order: 1 }),
    ];
    expectCode(content, "E_OPTION_ORDER");
  });

  it("E_MULTI_BALANCE: dos opciones balance", () => {
    const content = validContent();
    content.cards[0]!.options = [
      makeOption({ id: "o1", kind: "balance", unlockTag: "x" }),
      makeOption({ id: "o2", order: 2, kind: "balance", unlockTag: "x" }),
    ];
    expectCode(content, "E_MULTI_BALANCE");
  });

  it("E_DIFFICULTY: carta fuera de 1..10 y rango de etapa inválido", () => {
    const content = validContent();
    content.cards[0]!.difficulty = 11;
    expectCode(content, "E_DIFFICULTY", "cards[off_card_a].difficulty");

    const content2 = validContent();
    content2.stages[0]!.difficultyRange = { min: 5, max: 3 };
    expectCode(content2, "E_DIFFICULTY", "difficultyRange");
  });

  it("E_PARAM_RANGE: min>=max o initial fuera de rango", () => {
    const content = validContent();
    content.parameters[0]!.initialValue = 150;
    expectCode(content, "E_PARAM_RANGE", "parameters[off_param_p1]");
  });

  it("E_TEXT_EMPTY: texto default vacío", () => {
    const content = validContent();
    content.game.title = { default: "  " };
    expectCode(content, "E_TEXT_EMPTY", "game.title");

    const content2 = validContent();
    content2.cards[0]!.options[0]!.label = { default: "" };
    expectCode(content2, "E_TEXT_EMPTY", "options[0].label");
  });

  it("E_STAGE_ORDER: orders repetidos o sin etapas", () => {
    const content = validContent();
    content.stages.push(makeStage({ id: "off_stage_9", order: 1 }));
    expectCode(content, "E_STAGE_ORDER", "stages[off_stage_9].order");

    const content2 = validContent();
    content2.stages = [];
    expectCode(content2, "E_STAGE_ORDER");
  });

  it("E_INITIAL_ACTIVE: vacío o inexistente", () => {
    const content = validContent();
    content.game.config.initialActiveParameterIds = [];
    expectCode(content, "E_INITIAL_ACTIVE");
  });

  it("E_CARD_STATUS: carta no published dentro del mazo", () => {
    const content = validContent();
    content.cards[0]!.status = "draft";
    expectCode(content, "E_CARD_STATUS", "cards[off_card_a].status");
  });
});

describe("validateGameContent — warnings W_*", () => {
  it("los warnings no son errores", () => {
    const content = validContent();
    content.parameters[0]!.iconId = undefined; // W_NO_ICON
    content.parameters[0]!.thresholds = [
      { id: "off_thr_1", comparator: "lte", value: 20, effects: [{ type: "add_score", points: 1 }] },
    ]; // W_THRESHOLD_NO_END
    content.parameters.push(param("off_param_idle")); // W_PARAM_NEVER_ACTIVE
    content.parameters[0]!.thresholds.push({
      id: "off_thr_2",
      comparator: "gte",
      value: 150,
      once: true,
      effects: [],
    }); // W_THRESHOLD_RANGE
    content.cards[0]!.options.push(makeOption({ id: "o9", order: 2, kind: "balance" })); // W_BALANCE_UNGATED
    const issues = validateGameContent(content);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("W_NO_ICON");
    expect(codes).toContain("W_THRESHOLD_NO_END");
    expect(codes).toContain("W_PARAM_NEVER_ACTIVE");
    expect(codes).toContain("W_THRESHOLD_RANGE");
    expect(codes).toContain("W_BALANCE_UNGATED");
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
  });
});

describe("validateSituationCard", () => {
  it("carta oficial válida no tiene errores", () => {
    const content = validContent();
    const card = makeCard({
      id: "off_card_nueva",
      options: [
        makeOption({ id: "o1", effects: [{ type: "modify_parameter", parameterId: "off_param_p1", delta: 1 }] }),
      ],
    });
    const issues = validateSituationCard(card, content).filter((i) => i.severity === "error");
    expect(issues).toEqual([]);
  });

  it("detecta refs inexistentes y gameId distinto", () => {
    const content = validContent();
    const card = makeCard({
      id: "off_card_x",
      gameId: "otro",
      options: [makeOption({ id: "o1", effects: [{ type: "award_badge", badgeId: "off_badge_x" }] })],
    });
    const codes = validateSituationCard(card, content).map((i) => i.code);
    expect(codes).toContain("E_GAME_MISMATCH");
    expect(codes).toContain("E_REF_MISSING");
  });

  it("carta community exige prefijo usr_ y createdBy", () => {
    const content = validContent();
    const bad = makeCard({ id: "usr_card_1", origin: "community", createdBy: "" });
    const codes = validateSituationCard(bad, content).map((i) => i.code);
    expect(codes).toContain("E_ID_PREFIX");

    const bad2 = makeCard({ id: "off_card_1", origin: "community", createdBy: "usr_1" });
    expect(validateSituationCard(bad2, content).map((i) => i.code)).toContain("E_ID_PREFIX");

    const ok = makeCard({ id: "usr_card_1", origin: "community", createdBy: "usr_1" });
    expect(
      validateSituationCard(ok, content).filter((i) => i.severity === "error"),
    ).toEqual([]);
  });
});
