import { describe, expect, it } from "vitest";

import { contrastRatio, meetsAA, parseColor, relativeLuminance } from "./contrast";

describe("parseColor", () => {
  it("parses #rgb and #rrggbb", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#C1502E")).toEqual({ r: 193, g: 80, b: 46, a: 1 });
  });

  it("parses #rrggbbaa with alpha", () => {
    const c = parseColor("#C1502E80");
    expect(c).not.toBeNull();
    expect(c?.a).toBeCloseTo(128 / 255, 5);
  });

  it("parses rgb()/rgba()", () => {
    expect(parseColor("rgb(0, 0, 0)")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    const c = parseColor("rgba(10, 20, 30, 0.5)");
    expect(c?.a).toBeCloseTo(0.5, 5);
  });

  it("parses oklch()", () => {
    const white = parseColor("oklch(100% 0 0)");
    expect(white?.r).toBeGreaterThan(250);
    const black = parseColor("oklch(0% 0 0)");
    expect(black?.r).toBeLessThan(5);
    // Un valor real de los tokens de plataforma
    expect(parseColor("oklch(97% 0.012 75)")).not.toBeNull();
  });

  it("returns null for unsupported formats", () => {
    expect(parseColor("hsl(0, 0%, 50%)")).toBeNull();
    expect(parseColor("var(--x)")).toBeNull();
    expect(parseColor("not-a-color")).toBeNull();
    expect(parseColor("#zzzzzz")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("black vs white is 21", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 0);
  });

  it("same color is 1", () => {
    expect(contrastRatio("#abc", "#abc")).toBeCloseTo(1, 5);
  });

  it("returns null when a color cannot be parsed", () => {
    expect(contrastRatio("#fff", "hsl(0,0%,0%)")).toBeNull();
  });
});

describe("meetsAA", () => {
  it("applies 4.5 for normal text and 3 for large", () => {
    expect(meetsAA(4.5, "normal")).toBe(true);
    expect(meetsAA(4.49, "normal")).toBe(false);
    expect(meetsAA(3.0, "large")).toBe(true);
    expect(meetsAA(2.99, "large")).toBe(false);
    expect(meetsAA(null, "normal")).toBe(false);
  });
});

describe("relativeLuminance", () => {
  it("white is 1 and black is 0", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBeCloseTo(0, 5);
  });
});
