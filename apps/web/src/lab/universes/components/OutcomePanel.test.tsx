import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OutcomeView } from "../application/types";

import { EventChip } from "./EventChip";
import { OutcomePanel } from "./OutcomePanel";

const OUTCOME: OutcomeView = {
  chosenLabel: "Recaudar impuestos",
  outcomeText: "El tesoro crece, el pueblo murmura.",
  events: [
    { type: "param", tone: "gain", text: "Tesoro +8", parameterId: "p1", delta: 8 },
    { type: "param", tone: "loss", text: "Pueblo −5", parameterId: "p2", delta: -5 },
    { type: "stage_advanced", tone: "neutral", text: "Nueva etapa: Medio reinado" },
  ],
  ended: false,
};

describe("EventChip", () => {
  it("shows glyph + text per tone (meaning not color-only)", () => {
    const { container, rerender } = render(
      <ul><EventChip event={{ type: "x", tone: "gain", text: "Tesoro +8" }} /></ul>,
    );
    expect(container.textContent).toContain("▲");
    rerender(<ul><EventChip event={{ type: "x", tone: "loss", text: "Pueblo −5" }} /></ul>);
    expect(container.textContent).toContain("▼");
    rerender(<ul><EventChip event={{ type: "x", tone: "neutral", text: "Algo" }} /></ul>);
    expect(container.textContent).toContain("●");
  });
});

describe("OutcomePanel", () => {
  it("shows choice, outcome text and events grouped", () => {
    render(<OutcomePanel outcome={OUTCOME} onContinue={() => {}} />);
    expect(screen.getByText("Elegiste: Recaudar impuestos")).toBeTruthy();
    expect(screen.getByText(/El tesoro crece/)).toBeTruthy();
    expect(screen.getByText("Tesoro +8")).toBeTruthy();
    expect(screen.getByText(/Nueva etapa/)).toBeTruthy();
  });

  it("shows Continuar and focuses it", () => {
    const onContinue = vi.fn();
    render(<OutcomePanel outcome={OUTCOME} onContinue={onContinue} />);
    const btn = screen.getByRole("button", { name: "Continuar" });
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expect(onContinue).toHaveBeenCalled();
  });

  it("ended shows Ver final + result label in text", () => {
    render(
      <OutcomePanel outcome={{ ...OUTCOME, ended: true, result: "victory" }} onContinue={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Ver final" })).toBeTruthy();
    expect(screen.getByText("VICTORIA")).toBeTruthy();
  });
});
