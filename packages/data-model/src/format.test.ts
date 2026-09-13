import { describe, expect, it } from "vitest";
import { formatDateRange, formatMonthYear } from "./format";

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
