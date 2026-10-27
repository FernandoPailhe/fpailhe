import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ParameterView } from "../application/types";

import { ParameterBar } from "./ParameterBar";

const ICON = { kind: "initial" as const, initial: "T", label: "Tesoro" };

const VIEW: ParameterView = {
  id: "off_param_tesoro",
  key: "tesoro",
  name: "Tesoro",
  value: 32,
  min: 0,
  max: 100,
  ratio: 0.32,
  delta: null,
  risk: null,
};

describe("ParameterBar", () => {
  it("exposes an accessible meter with value, range and label", () => {
    render(<ParameterBar view={VIEW} icon={ICON} showName />);
    const meter = screen.getByRole("meter");
    expect(meter.getAttribute("aria-label")).toBe("Tesoro");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
    expect(meter.getAttribute("aria-valuenow")).toBe("32");
    expect(meter.getAttribute("aria-valuetext")).toBe("32 de 100");
  });

  it("shows risk chip with glyph + text (not just color)", () => {
    render(<ParameterBar view={{ ...VIEW, risk: "low" }} icon={ICON} showName />);
    expect(screen.getByText(/CRÍTICO BAJO/)).toBeTruthy();
    const meter = screen.getByRole("meter");
    expect(meter.getAttribute("aria-valuetext")).toContain("riesgo bajo");
  });

  it("shows the delta with sign and direction", () => {
    render(<ParameterBar view={{ ...VIEW, delta: 8 }} icon={ICON} showName />);
    expect(screen.getByText("▲ +8")).toBeTruthy();
  });

  it("hides the name visually when already seen but keeps it accessible", () => {
    const { container } = render(<ParameterBar view={VIEW} icon={ICON} showName={false} />);
    const name = container.querySelector(".uv-sr-only");
    expect(name?.textContent).toBe("Tesoro");
  });
});
