import { describe, expect, it } from "vitest";
import type { Parameter, Power, Character, Icon } from "../domain/models";
import { makeCard, makeContent, makeOption, makeSession } from "../domain/engine/testing";
import {
  buildCardView,
  buildEndView,
  buildIconViews,
  buildOutcomeView,
  buildParameterViews,
  buildPowerViews,
  buildThemeInput,
} from "./viewModels";

const T0 = "2026-01-01T00:00:00.000Z";
const scoped = (id: string) => ({
  id,
  gameId: "off_game_test",
  schemaVersion: 1,
  createdAt: T0,
  updatedAt: T0,
});
const lt = (defaultText: string, en?: string) => ({
  default: defaultText,
  ...(en ? { translations: { en } } : {}),
});

const param = (id: string, key: string, overrides: Partial<Parameter> = {}): Parameter => ({
  ...scoped(id),
  key,
  name: lt(key),
  min: 0,
  max: 100,
  initialValue: 50,
  thresholds: [{ id: `${id}_t`, comparator: "lte", value: 0, effects: [] }],
  ...overrides,
});

const power = (id: string, overrides: Partial<Power> = {}): Power =>
  ({
    ...scoped(id),
    key: id,
    name: lt(id),
    kind: "shield",
    blocksThreatTags: ["t"],
    ...overrides,
  }) as Power;

const character = (id: string, overrides: Partial<Character> = {}): Character => ({
  ...scoped(id),
  key: id,
  name: lt(`Nombre ${id}`),
  title: lt(`Título ${id}`),
  themeTags: [],
  unlockedByDefault: true,
  ...overrides,
});

describe("buildParameterViews", () => {
  const content = makeContent({
    parameters: [
      param("p1", "tesoro", { name: lt("Tesoro", "Treasury") }),
      param("p2", "pueblo"),
      param("p3", "ejercito"),
    ],
  });
  const session = makeSession({
    parameters: { p1: 50, p2: 90, p3: 30 },
    activeParameterIds: ["p1", "p2"],
  });

  it("solo muestra activos, en orden de content.parameters", () => {
    const views = buildParameterViews(content, session);
    expect(views.map((v) => v.id)).toEqual(["p1", "p2"]);
  });

  it("ratio, delta y risk correctos", () => {
    const views = buildParameterViews(content, session, { p1: 40, p2: 90 });
    expect(views[0]!.ratio).toBe(0.5);
    expect(views[0]!.delta).toBe(10);
    expect(views[1]!.delta).toBeNull();
    expect(views[0]!.name).toBe("Tesoro");
    // p2 a 90 con threshold lte 0: sin riesgo bajo ni alto
    expect(views[1]!.risk).toBeNull();
    const risky = buildParameterViews(content, makeSession({
      parameters: { p1: 5, p2: 90, p3: 30 },
      activeParameterIds: ["p1", "p2"],
    }));
    expect(risky[0]!.risk).toBe("low");
  });
});

describe("buildPowerViews", () => {
  it("mapea poderes poseídos con nombre y kind", () => {
    const content = makeContent({
      powers: [
        power("pw1", { name: lt("Guardia"), kind: "shield", blocksThreatTags: ["t"], maxCharges: 3 }),
        power("pw2", { name: lt("Consejo"), kind: "option_unlock", unlocksOptionTag: "sab" } as never),
      ],
    });
    const session = makeSession({ powers: [{ powerId: "pw1", charges: 2 }] });
    const views = buildPowerViews(content, session, "es");
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ id: "pw1", name: "Guardia", kind: "shield", charges: 2, maxCharges: 3 });
  });
});

describe("buildCardView", () => {
  const powerUnlock = power("pw_sab", {
    name: lt("Consejo sabio"),
    kind: "option_unlock",
    unlocksOptionTag: "sabiduria",
  } as never);
  const content = makeContent({
    powers: [powerUnlock],
    characters: [character("ch1")],
    assets: [
      { ...scoped("as1"), type: "image" as const, url: "/img.png", mimeType: "image/png", altText: lt("Ilustración") , status: "published", createdBy: "system", origin: "official" },
    ],
  });
  const session = makeSession({ powers: [] });
  const card = makeCard({
    text: lt("Situación de prueba", "Test situation"),
    characterId: "ch1",
    options: [
      makeOption({ id: "o1", order: 1, label: lt("Normal") }),
      makeOption({
        id: "o2",
        order: 2,
        label: lt("Equilibrio"),
        kind: "balance",
        availability: { type: "has_power", powerId: "pw_sab" },
        whenUnavailable: "show_locked",
      }),
      makeOption({
        id: "o3",
        order: 3,
        label: lt("Oculta"),
        availability: { type: "has_power", powerId: "pw_sab" },
        whenUnavailable: "hide",
      }),
    ],
  });

  it("texto y opciones: hide no aparece, show_locked trae lockedReason", () => {
    const view = buildCardView(card, content, session, "es");
    expect(view.text).toBe("Situación de prueba");
    expect(view.options.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(view.options[0]!.state).toBe("available");
    expect(view.options[1]!.state).toBe("locked");
    expect(view.options[1]!.lockedReason).toBe("Requiere: Consejo sabio");
  });

  it("traducción en", () => {
    const view = buildCardView(card, content, session, "en");
    expect(view.text).toBe("Test situation");
  });

  it("speaker cuando hay characterId", () => {
    const view = buildCardView(card, content, session, "es");
    expect(view.speaker?.name).toBe("Nombre ch1");
    expect(view.speaker?.title).toBe("Título ch1");
  });

  it("media cuando hay assetId; sin asset ni personaje queda solo texto", () => {
    const withAsset = buildCardView(makeCard({ assetId: "as1" }), content, session, "es");
    expect(withAsset.media?.url).toBe("/img.png");
    expect(withAsset.media?.alt).toBe("Ilustración");
    const plain = buildCardView(makeCard(), content, session, "es");
    expect(plain.media).toBeUndefined();
    expect(plain.speaker).toBeUndefined();
  });
});

describe("buildOutcomeView / buildEndView", () => {
  const content = makeContent({
    parameters: [param("p1", "tesoro", { name: lt("Tesoro") })],
    powers: [power("pw1", { name: lt("Guardia real") })],
    badges: [
      { ...scoped("b1"), key: "b1", name: lt("Medalla"), rarity: "common" },
    ],
    stages: [
      { id: "st1", gameId: "g", schemaVersion: 1, createdAt: T0, updatedAt: T0, order: 1, name: lt("Etapa uno"), minScore: 0, difficultyRange: { min: 1, max: 10 } },
    ],
  });
  const card = makeCard({
    options: [
      makeOption({ id: "o1", label: lt("Elegida"), outcomeText: lt("Salió bien") }),
    ],
  });
  const session = makeSession({ status: "lost", stageId: "st1" });

  it("chosenLabel, outcomeText, eventos con tono y ended", () => {
    const view = buildOutcomeView(
      card,
      "o1",
      [
        { type: "parameter_changed", parameterId: "p1", from: 50, to: 40, delta: -10 },
        { type: "power_granted", powerId: "pw1", charges: 1 },
        { type: "card_enqueued", cardId: "c9", dueTurn: 3 },
        { type: "game_ended", outcome: "defeat", endingKey: "x" },
      ],
      session,
      content,
      "es",
    );
    expect(view.chosenLabel).toBe("Elegida");
    expect(view.outcomeText).toBe("Salió bien");
    expect(view.ended).toBe(true);
    expect(view.result).toBe("defeat");
    expect(view.events).toHaveLength(2);
    expect(view.events[0]).toMatchObject({ tone: "loss", parameterId: "p1", delta: -10 });
    expect(view.events[0]!.text).toBe("Tesoro -10");
    expect(view.events[1]).toMatchObject({ tone: "gain" });
    expect(view.events[1]!.text).toBe("Poder obtenido: Guardia real");
  });

  it("buildEndView: final definido y genérico", () => {
    const withEndings = makeContent({
      ...content,
      game: {
        ...content.game,
        metadata: {
          endings: { x: { title: lt("Fin"), text: lt("Texto del final") } },
        },
      },
      badges: content.badges,
      stages: content.stages,
    });
    const won = makeSession({ status: "won", endingKey: "x", turn: 12, score: 30, stageId: "st1", earnedBadgeIds: ["b1"], parameters: { p1: 100 }, activeParameterIds: ["p1"] });
    const view = buildEndView(withEndings, won, "es");
    expect(view).toMatchObject({ result: "victory", title: "Fin", text: "Texto del final", turns: 12, score: 30, stageName: "Etapa uno" });
    expect(view.badges[0]).toMatchObject({ id: "b1", name: "Medalla" });
    expect(view.parameters).toHaveLength(1);

    const abandoned = buildEndView(content, makeSession({ status: "abandoned", stageId: "st1" }), "es");
    expect(abandoned.title).toBe("Partida abandonada");
    expect(abandoned.result).toBe("abandoned");
  });
});

describe("buildIconViews / buildThemeInput", () => {
  it("labels localizadas e íconos sin svg se incluyen", () => {
    const icon: Icon = { ...scoped("i1"), key: "i1", label: lt("Tesoro", "Treasury"), semanticTags: ["dinero"] };
    const views = buildIconViews(makeContent({ icons: [icon] }), "en");
    expect(views["i1"]).toEqual({ svg: undefined, label: "Treasury", semanticTags: ["dinero"] });
  });

  it("activa overrides cuya condición se cumple e ignora inválidos", () => {
    const branch = { id: "br1", gameId: "g", schemaVersion: 1, createdAt: T0, updatedAt: T0, key: "guerra", name: lt("Guerra") };
    const aesthetic = {
      ...scoped("ae1"),
      key: "a",
      name: lt("a"),
      version: 1,
      artDirection: {} as never,
      tokens: {} as never,
      typography: {} as never,
      iconStyle: {} as never,
      overrides: [
        { id: "ov1", when: { type: "in_branch" as const, branchId: "br1" }, colors: { accent: "#fff" } },
        { id: "ov2", when: { type: "nonsense" } as never, colors: { accent: "#000" } },
      ],
    } as never;
    const content = makeContent({ branches: [branch as never], aesthetic });
    const inBranch = buildThemeInput(content, makeSession({ branchIds: ["br1"] }));
    expect(inBranch.activeOverrides.map((o) => o.id)).toEqual(["ov1"]);
    const outBranch = buildThemeInput(content, makeSession({ branchIds: [] }));
    expect(outBranch.activeOverrides).toEqual([]);
    expect(buildThemeInput(content, null).activeOverrides).toEqual([]);
  });
});
