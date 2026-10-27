import { describe, expect, it } from "vitest";

import type { IconView } from "../application/types";

import { resolveIcon } from "./iconResolver";

const ICONS: Record<string, IconView> = {
  coin: { svg: '<svg viewBox="0 0 1 1"><circle cx="0.5" cy="0.5" r="0.5"/></svg>', label: "Moneda", semanticTags: ["tesoro"] },
  shield: { svg: '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>', label: "Escudo", semanticTags: ["shield"] },
  broken: { svg: "<div>no es svg</div>", label: "Roto", semanticTags: ["tesoro"] },
};

describe("resolveIcon", () => {
  it("prefers the referenced icon with a valid svg", () => {
    const r = resolveIcon({ iconId: "coin", fallbackTags: ["shield"], name: "Tesoro", icons: ICONS });
    expect(r.kind).toBe("svg");
    if (r.kind === "svg") expect(r.label).toBe("Moneda");
  });

  it("falls back to semantic tags when the referenced icon is missing or invalid", () => {
    const missing = resolveIcon({ iconId: "nope", fallbackTags: ["shield"], name: "Guardia", icons: ICONS });
    expect(missing.kind).toBe("svg");
    if (missing.kind === "svg") expect(missing.label).toBe("Escudo");

    const invalid = resolveIcon({ iconId: "broken", fallbackTags: ["shield"], name: "Guardia", icons: ICONS });
    expect(invalid.kind).toBe("svg");
    if (invalid.kind === "svg") expect(invalid.label).toBe("Escudo");
  });

  it("falls back to the name initial when nothing else matches", () => {
    const r = resolveIcon({ iconId: "nope", fallbackTags: ["zzz"], name: " prestigio ", icons: ICONS });
    expect(r).toEqual({ kind: "initial", initial: "P", label: " prestigio " });
  });

  it("an icon without svg does not short-circuit the chain", () => {
    const noSvg: Record<string, IconView> = {
      asset: { assetId: "a1", label: "Asset", semanticTags: ["coin"] } as unknown as IconView,
    };
    const r = resolveIcon({ iconId: "asset", fallbackTags: ["zzz"], name: "Oro", icons: { ...noSvg } });
    expect(r.kind).toBe("initial");
  });
});
