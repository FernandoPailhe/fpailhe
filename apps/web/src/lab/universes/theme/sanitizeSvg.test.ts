import { describe, expect, it } from "vitest";

import { sanitizeSvg } from "./sanitizeSvg";

describe("sanitizeSvg", () => {
  it("keeps allowed elements and presentation attributes", () => {
    const out = sanitizeSvg(
      '<svg viewBox="0 0 24 24"><g transform="translate(1 1)"><path d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="4" stroke="black"/></g></svg>',
    );
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain("<path");
    expect(out).toContain("<circle");
    expect(out).toContain('transform="translate(1 1)"');
  });

  it("adds fill=currentColor to the root when missing", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
    expect(out).toContain('fill="currentColor"');
  });

  it("removes scripts, event handlers, style and href", () => {
    const out = sanitizeSvg(
      '<svg viewBox="0 0 24 24" onload="alert(1)" style="fill:red"><script>alert(2)</script><a href="https://evil.example"><path d="M0 0"/></a><use href="x"/></svg>',
    );
    expect(out).not.toBeNull();
    expect(out).not.toContain("script");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("style");
    expect(out).not.toContain("href");
    expect(out).not.toContain("<a");
    expect(out).not.toContain("<use");
  });

  it("returns null for non-SVG input", () => {
    expect(sanitizeSvg("<div>hola</div>")).toBeNull();
    expect(sanitizeSvg("texto plano")).toBeNull();
  });
});
