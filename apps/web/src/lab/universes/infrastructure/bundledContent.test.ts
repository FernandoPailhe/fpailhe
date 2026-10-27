import { describe, expect, it } from "vitest";
import { validateGameContent } from "../domain/engine/validation";
import {
  createBundledCardRepository,
  createBundledGameContentRepository,
  loadGameContent,
  loadRawBundle,
} from "./bundledContent";
import { UnknownUniverseError } from "./errors";

describe("loadRawBundle", () => {
  it("carga el fixture demo-reino completo", async () => {
    const bundle = await loadRawBundle("demo-reino");
    expect(bundle.game.slug).toBe("demo-reino");
    expect(bundle.stages.length).toBeGreaterThan(0);
    expect(bundle.parameters.length).toBeGreaterThan(0);
    expect(bundle.cards.length).toBeGreaterThan(0);
  });

  it("memoiza: dos cargas devuelven la misma promesa", () => {
    const a = loadRawBundle("demo-reino");
    const b = loadRawBundle("demo-reino");
    expect(a).toBe(b);
  });

  it("slug desconocido → UnknownUniverseError", async () => {
    await expect(loadRawBundle("no-existe")).rejects.toBeInstanceOf(UnknownUniverseError);
  });
});

describe("repositorios embebidos + loadGameContent", () => {
  it("arma el GameContent y pasa la validación sin errores", async () => {
    const repo = createBundledGameContentRepository();
    const cards = createBundledCardRepository();
    const content = await loadGameContent(repo, cards, "demo-reino");
    expect(content.game.slug).toBe("demo-reino");
    expect(content.stages.map((s) => s.order)).toEqual(
      [...content.stages.map((s) => s.order)].sort((a, b) => a - b),
    );
    expect(content.cards.every((c) => c.status === "published")).toBe(true);
    const errors = validateGameContent(content).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("los archivos opcionales ausentes devuelven listas vacías", async () => {
    const repo = createBundledGameContentRepository();
    const cards = createBundledCardRepository();
    const content = await loadGameContent(repo, cards, "demo-reino");
    expect(Array.isArray(content.branches)).toBe(true);
    expect(Array.isArray(content.assets)).toBe(true);
    expect(Array.isArray(content.icons)).toBe(true);
  });

  it("getCardCounters devuelve [] (sin estadísticas)", async () => {
    const repo = createBundledGameContentRepository();
    const cards = createBundledCardRepository();
    const game = await repo.getGameBySlug("demo-reino");
    expect(await cards.getCardCounters(game!.id)).toEqual([]);
  });

  it("loadGameContent con slug desconocido → UnknownUniverseError", async () => {
    const repo = createBundledGameContentRepository();
    const cards = createBundledCardRepository();
    await expect(loadGameContent(repo, cards, "no-existe")).rejects.toBeInstanceOf(
      UnknownUniverseError,
    );
  });

  it("getters por gameId resuelven tras getGameBySlug", async () => {
    const repo = createBundledGameContentRepository();
    const game = await repo.getGameBySlug("demo-reino");
    const stages = await repo.getStages(game!.id);
    expect(stages.length).toBeGreaterThan(0);
    const aesthetic = await repo.getAesthetic(game!.aestheticId);
    expect(aesthetic).toBeDefined();
  });
});
