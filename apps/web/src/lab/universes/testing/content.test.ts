import { describe, expect, it } from "vitest";
import { assembleGameContent } from "../domain/engine/content";
import { validateGameContent } from "../domain/engine/validation";
import { endingFor } from "../domain/extensions";
import type { Effect } from "../domain/models";
import type { GameContent } from "../domain/engine/types";
import { loadAllBundles } from "./loadAllBundles";

const bundles = loadAllBundles();

function contentOf(slug: string): GameContent {
  const b = bundles.find((x) => x.slug === slug);
  if (!b) throw new Error(`bundle ${slug} no encontrado`);
  return assembleGameContent(b.raw);
}

function allEffects(content: GameContent): Effect[] {
  const effects: Effect[] = [];
  for (const p of content.parameters)
    for (const t of p.thresholds) effects.push(...t.effects);
  for (const s of content.stages) effects.push(...(s.onEnter ?? []));
  for (const c of content.cards)
    for (const o of c.options) effects.push(...o.effects);
  return effects;
}

function endingKeysUsed(content: GameContent): Set<string> {
  const keys = new Set<string>(["no_cards"]);
  for (const e of allEffects(content))
    if (e.type === "end_game" && e.endingKey) keys.add(e.endingKey);
  return keys;
}

describe("validación de contenido embebido", () => {
  it("hay al menos un bundle (el fixture)", () => {
    expect(bundles.length).toBeGreaterThan(0);
  });

  for (const { slug, origin, raw } of bundles) {
    describe(`${origin}/${slug}`, () => {
      const content = assembleGameContent(raw);
      const issues = validateGameContent(content);
      const errors = issues.filter((i) => i.severity === "error");
      const warnings = issues.filter((i) => i.severity === "warning");

      it("la carpeta coincide con game.slug", () => {
        expect(raw.game.slug).toBe(slug);
      });

      if (raw.game.status === "published") {
        it("no tiene errores de validación", () => {
          expect(
            errors.map((e) => `${e.code} @ ${e.path}: ${e.message}`),
          ).toEqual([]);
        });

        it("todos los endingKey usados existen en metadata.endings", () => {
          for (const key of endingKeysUsed(content)) {
            expect(endingFor(raw.game, key), `endingKey "${key}"`).toBeDefined();
          }
        });

        it("cada Icon referenciado tiene svg o assetId", () => {
          const referenced = new Set(
            [
              ...content.parameters.map((p) => p.iconId),
              ...content.powers.map((p) => p.iconId),
              ...content.badges.map((b) => b.iconId),
            ].filter((x): x is string => !!x),
          );
          for (const iconId of referenced) {
            const icon = content.icons.find((i) => i.id === iconId);
            expect(icon, `icon ${iconId}`).toBeDefined();
            expect(
              icon!.svg !== undefined || icon!.assetId !== undefined,
              `icon ${iconId} sin svg ni assetId`,
            ).toBe(true);
          }
        });
      } else {
        it("draft: los errores se reportan pero no rompen", () => {
          if (errors.length > 0)
            console.warn(
              `${slug} (draft) tiene ${errors.length} errores:`,
              errors.map((e) => `${e.code} @ ${e.path}`),
            );
          expect(true).toBe(true);
        });
      }

      it("los warnings son informativos", () => {
        if (warnings.length > 0)
          console.warn(
            `${slug} warnings:`,
            warnings.map((w) => `${w.code} @ ${w.path}`),
          );
        expect(true).toBe(true);
      });
    });
  }
});

describe("demo-reino: cobertura del plan", () => {
  const content = contentOf("demo-reino");
  const { game } = content;

  it("identidad y locales", () => {
    expect(game.slug).toBe("demo-reino");
    expect(game.title.default).toBe("Reino de pruebas");
    expect(game.status).toBe("published");
    expect(game.defaultLocale).toBe("es");
    expect(game.supportedLocales).toEqual(["es", "en"]);
    expect(game.config.allowCardFeedback).toBe(true);
    expect(game.metadata?.placeholder).toBe(true);
  });

  it("parámetros crecen de 2 a 4 por etapa", () => {
    const s = content.stages;
    expect(s).toHaveLength(3);
    expect(game.config.initialActiveParameterIds).toHaveLength(2);
    expect(s[1]!.activatesParameterIds).toContain("off_param_ejercito");
    expect(s[2]!.activatesParameterIds).toContain("off_param_prestigio");
    expect(content.parameters).toHaveLength(4);
  });

  it("thresholds 0/100 y finales", () => {
    for (const p of content.parameters)
      expect(p.thresholds.some((t) => t.comparator === "lte" && t.value === 0)).toBe(true);
    const pueblo = content.parameters.find((p) => p.key === "pueblo")!;
    expect(pueblo.thresholds.some((t) => t.comparator === "gte" && t.value === 100)).toBe(true);
    const prestigio = content.parameters.find((p) => p.key === "prestigio")!;
    expect(prestigio.thresholds.some((t) => t.comparator === "gte" && t.value === 100)).toBe(true);
    for (const key of ["sin_tesoro", "sin_pueblo", "coronacion", "no_cards"])
      expect(endingFor(game, key), key).toBeDefined();
  });

  it("hay un escudo cuyo blocksThreatTags usa algún threshold", () => {
    const threatTags = new Set(
      content.parameters.flatMap((p) => p.thresholds.flatMap((t) => t.threatTags ?? [])),
    );
    const shield = content.powers.find(
      (p) => p.kind === "shield" && p.blocksThreatTags?.some((t) => threatTags.has(t)),
    );
    expect(shield?.id).toBe("off_power_guardia");
  });

  it("hay opción balance bloqueada por poder con show_locked", () => {
    const found = content.cards.some((c) =>
      c.options.some(
        (o) =>
          o.kind === "balance" &&
          o.availability?.type === "has_power" &&
          o.whenUnavailable === "show_locked",
      ),
    );
    expect(found).toBe(true);
  });

  it("hay cartas de 1, 2 y 3 opciones", () => {
    const counts = new Set(content.cards.map((c) => c.options.length));
    expect(counts.has(1)).toBe(true);
    expect(counts.has(2)).toBe(true);
    expect(counts.has(3)).toBe(true);
  });

  it("ramas exclusivas + cartas de rama + cartas globales", () => {
    const groups = content.branches.map((b) => b.exclusiveGroup);
    expect(content.branches).toHaveLength(2);
    expect(new Set(groups).size).toBe(1);
    const branchCards = content.cards.filter((c) => c.availability.branchIds?.length);
    expect(branchCards.length).toBeGreaterThanOrEqual(4);
    expect(content.cards.length - branchCards.length).toBeGreaterThan(0);
  });

  it("memoria: hay una condición card_seen", () => {
    const found = content.cards.some((c) =>
      c.availability.conditions && JSON.stringify(c.availability.conditions).includes("card_seen"),
    );
    expect(found).toBe(true);
  });

  it("recurrencia: once, repeatable y cooldown", () => {
    expect(content.cards.some((c) => c.recurrence.mode === "once")).toBe(true);
    expect(
      content.cards.some(
        (c) => c.recurrence.mode === "repeatable" && c.recurrence.cooldownTurns !== undefined,
      ),
    ).toBe(true);
  });

  it("personaje bloqueado → desbloqueable", () => {
    const locked = content.characters.find((c) => !c.unlockedByDefault);
    expect(locked).toBeDefined();
    const unlocks = allEffects(content).some(
      (e) => e.type === "unlock_character" && e.characterId === locked!.id,
    );
    expect(unlocks).toBe(true);
    expect(content.cards.some((c) => c.characterId === locked!.id)).toBe(true);
  });

  it("carta sin personaje, con personaje y con asset", () => {
    expect(content.cards.some((c) => !c.characterId)).toBe(true);
    expect(content.cards.some((c) => !!c.characterId)).toBe(true);
    expect(content.cards.some((c) => !!c.assetId)).toBe(true);
  });

  it("cola forzada: enqueue_card con delayTurns", () => {
    const found = allEffects(content).some(
      (e) => e.type === "enqueue_card" && e.delayTurns !== undefined,
    );
    expect(found).toBe(true);
  });

  it("poderes modifier y option_unlock", () => {
    expect(content.powers.some((p) => p.kind === "modifier")).toBe(true);
    expect(content.powers.some((p) => p.kind === "option_unlock")).toBe(true);
  });

  it("etapas: minScore y difficultyRange", () => {
    const s = content.stages;
    expect(s[0]!.minScore).toBe(0);
    expect(s[1]!.minScore).toBeGreaterThan(0);
    expect(s[2]!.minScore).toBeGreaterThan(s[1]!.minScore);
    for (const stage of s) expect(stage.difficultyRange).toBeDefined();
  });

  it("traducciones en: juego, ≥2 parámetros, ≥2 cartas", () => {
    expect(game.title.translations?.en).toBeTruthy();
    const params = content.parameters.filter((p) => p.name.translations?.en);
    expect(params.length).toBeGreaterThanOrEqual(2);
    const cards = content.cards.filter((c) => c.text.translations?.en);
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it("un parámetro y un poder sin iconId (fallback de UI)", () => {
    expect(content.parameters.some((p) => !p.iconId)).toBe(true);
    expect(content.powers.some((p) => !p.iconId)).toBe(true);
  });
});
