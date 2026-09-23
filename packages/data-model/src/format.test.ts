import { describe, expect, it } from "vitest";
import { formatDateRange, formatMonthYear, formatProjectLinkLabel, toHref } from "./format";

describe("formatMonthYear", () => {
  it('formats "2025-08" as "Aug 2025"', () => {
    expect(formatMonthYear("2025-08")).toBe("Aug 2025");
  });
});

describe("formatDateRange", () => {
  it('renders "Present" for null end date', () => {
    expect(formatDateRange("2025-08", null)).toBe("Aug 2025 — Present");
  });

  it("renders closed range", () => {
    expect(formatDateRange("2023-04", "2025-08")).toBe("Apr 2023 — Aug 2025");
  });
});

describe("toHref", () => {
  it("returns absolute URLs as-is", () => {
    expect(toHref("https://github.com/FernandoPailhe")).toBe(
      "https://github.com/FernandoPailhe",
    );
  });

  it("normalizes www and bare domains to https", () => {
    expect(toHref("www.fpailhe.com")).toBe("https://www.fpailhe.com");
    expect(toHref("fpailhe.com")).toBe("https://fpailhe.com");
  });

  it("maps emails to mailto", () => {
    expect(toHref("ferpai@gmail.com")).toBe("mailto:ferpai@gmail.com");
  });

  it("returns null for plain text", () => {
    expect(toHref("Buenos Aires")).toBeNull();
    expect(toHref("01161716045")).toBeNull();
    expect(toHref("React Native")).toBeNull();
  });
});

describe("formatProjectLinkLabel", () => {
  it("maps each link type to its label", () => {
    expect(formatProjectLinkLabel("appStore")).toBe("App Store");
    expect(formatProjectLinkLabel("playStore")).toBe("Play Store");
    expect(formatProjectLinkLabel("github")).toBe("GitHub");
    expect(formatProjectLinkLabel("website")).toBe("Website");
    expect(formatProjectLinkLabel("youtube")).toBe("YouTube");
  });
});
