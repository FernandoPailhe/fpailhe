import { describe, expect, it } from "vitest";
import { assembleGameContent, mergeCards } from "./content";
import { makeCard, makeContent, makeOption, makeStage } from "./testing";

const base = () =>
  makeContent({
    stages: [
      makeStage({ id: "off_stage_2", order: 2 }),
      makeStage({ id: "off_stage_1", order: 1 }),
    ],
    cards: [makeCard({ id: "off_card_a", status: "published" })],
  });

describe("assembleGameContent", () => {
  it("ordena etapas por order y deja solo cartas published", () => {
    const content = assembleGameContent({
      game: base().game,
      stages: base().stages,
      branches: [],
      parameters: [],
      characters: [],
      powers: [],
      badges: [],
      icons: [],
      assets: [],
      cards: [
        makeCard({ id: "off_card_pub", status: "published" }),
        makeCard({ id: "off_card_draft", status: "draft" }),
        makeCard({ id: "off_card_rev", status: "in_review" }),
      ],
    });
    expect(content.stages.map((s) => s.id)).toEqual(["off_stage_1", "off_stage_2"]);
    expect(content.cards.map((c) => c.id)).toEqual(["off_card_pub"]);
  });
});

describe("mergeCards", () => {
  it("agrega cartas válidas", () => {
    const content = base();
    const extra = makeCard({ id: "usr_card_1", origin: "community", createdBy: "usr_9" });
    const { content: merged, dropped } = mergeCards(content, [extra]);
    expect(merged.cards.map((c) => c.id)).toEqual(["off_card_a", "usr_card_1"]);
    expect(dropped).toEqual([]);
  });

  it("descarta duplicadas (gana la existente)", () => {
    const content = base();
    const dup = makeCard({ id: "off_card_a", text: { default: "otra" } });
    const { content: merged, dropped } = mergeCards(content, [dup]);
    expect(merged.cards).toHaveLength(1);
    expect(merged.cards[0]!.text.default).toBe("Situación");
    expect(dropped).toEqual([{ cardId: "off_card_a", reason: "duplicate", issues: [] }]);
  });

  it("descarta inválidas con sus issues", () => {
    const content = base();
    const bad = makeCard({
      id: "usr_card_mal",
      origin: "community",
      createdBy: "usr_9",
      options: [makeOption({ id: "o1", effects: [{ type: "award_badge", badgeId: "no_existe" }] })],
    });
    const { content: merged, dropped } = mergeCards(content, [bad]);
    expect(merged.cards).toHaveLength(1);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.reason).toBe("invalid");
    expect(dropped[0]!.issues.some((i) => i.code === "E_REF_MISSING")).toBe(true);
  });

  it("descarta cartas no published", () => {
    const content = base();
    const draft = makeCard({ id: "usr_draft", origin: "community", createdBy: "usr_9", status: "in_review" });
    const { dropped } = mergeCards(content, [draft]);
    expect(dropped[0]!.reason).toBe("invalid");
    expect(dropped[0]!.issues.some((i) => i.code === "E_CARD_STATUS")).toBe(true);
  });

  it("es inmutable con el contenido de entrada", () => {
    const content = base();
    const extra = makeCard({ id: "usr_card_1", origin: "community", createdBy: "usr_9" });
    const { content: merged } = mergeCards(content, [extra]);
    expect(content.cards).toHaveLength(1);
    expect(merged).not.toBe(content);
  });
});
