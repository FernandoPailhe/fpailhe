import { describe, expect, it } from "vitest";
import { localize, resolveLocale } from "./localize";
import { makeGame } from "./testing";

describe("localize", () => {
  const text = {
    default: "Hola",
    translations: { en: "Hello", "es-MX": "Qué tal", fr: "" },
  };

  it("devuelve la traducción exacta del locale", () => {
    expect(localize(text, "en")).toBe("Hello");
    expect(localize(text, "es-MX")).toBe("Qué tal");
  });

  it("cae a la traducción de la base del locale", () => {
    expect(localize(text, "es-AR")).toBe("Hola"); // sin es-AR ni es → default
    expect(localize({ default: "D", translations: { en: "E" } }, "en-GB")).toBe("E");
  });

  it("una traducción vacía cuenta como ausente", () => {
    expect(localize(text, "fr")).toBe("Hola");
  });

  it("cae al default si no hay traducción", () => {
    expect(localize(text, "de")).toBe("Hola");
  });

  it("undefined → string vacío", () => {
    expect(localize(undefined, "en")).toBe("");
  });
});

describe("resolveLocale", () => {
  const game = makeGame({ defaultLocale: "es", supportedLocales: ["es", "en-US", "pt-BR"] });

  it("coincidencia exacta (case-insensitive)", () => {
    expect(resolveLocale(game, ["EN-us"])).toBe("en-US");
  });

  it("coincidencia por base del idioma", () => {
    expect(resolveLocale(game, ["en-GB"])).toBe("en-US");
    expect(resolveLocale(game, ["pt"])).toBe("pt-BR");
  });

  it("respeta el orden de preferencia", () => {
    expect(resolveLocale(game, ["en", "es"])).toBe("en-US");
    expect(resolveLocale(game, ["es", "en"])).toBe("es");
  });

  it("cae al defaultLocale sin coincidencias", () => {
    expect(resolveLocale(game, ["de", "fr"])).toBe("es");
    expect(resolveLocale(game, [])).toBe("es");
  });
});
