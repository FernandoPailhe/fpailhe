import { describe, expect, it } from "vitest";
import { findUniverse, isDevOrTest, listUniverses } from "./registry";

describe("registry", () => {
  it("en tests, isDevOrTest() es true", () => {
    expect(isDevOrTest()).toBe(true);
  });

  it("listUniverses({ includeUnpublished: true }) incluye el fixture demo-reino", async () => {
    const entries = await listUniverses({ includeUnpublished: true });
    const demo = entries.find((e) => e.slug === "demo-reino");
    expect(demo).toBeDefined();
    expect(demo?.basePath).toBe("fixture");
    expect(demo?.game.slug).toBe("demo-reino");
  });

  it("findUniverse devuelve la entrada por slug", async () => {
    const entry = await findUniverse("demo-reino");
    expect(entry?.slug).toBe("demo-reino");
  });

  it("findUniverse con slug inexistente → undefined", async () => {
    expect(await findUniverse("no-existe")).toBeUndefined();
  });

  it("un slug que no coincide con game.slug se omite (no rompe la lista)", async () => {
    // Si existiera una carpeta cuyo game.slug difiere, se omite.
    // Acá solo comprobamos que listar no falla.
    const entries = await listUniverses({ includeUnpublished: true });
    for (const e of entries) expect(e.game.slug).toBe(e.slug);
  });
});
