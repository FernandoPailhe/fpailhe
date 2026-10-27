import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ThemeInput } from "../application/types";
import { aestheticAlt } from "../testing/aestheticAlt";
import { DARK, makeAesthetic } from "../theme/testAestheticFixture";

import { Hud } from "./Hud";
import { OptionList } from "./OptionList";
import { SituationCard } from "./SituationCard";
import { ThemeScope } from "./ThemeScope";

describe("ThemeScope", () => {
  it("applies --uv-* css vars, data-scheme, transition and lang", () => {
    const { container } = render(
      <ThemeScope theme={{ activeOverrides: [] }} locale="es">
        <p>hola</p>
      </ThemeScope>,
    );
    const el = container.querySelector<HTMLElement>(".uv");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("lang")).toBe("es");
    expect(el?.getAttribute("data-scheme")).toBe("light");
    expect(el?.getAttribute("data-card-transition")).toBe("fade");
    expect(el?.style.getPropertyValue("--uv-color-background")).toBeTruthy();
    expect(el?.style.getPropertyValue("--uv-font-body")).toContain("Work Sans");
    expect(el?.style.getPropertyValue("--uv-motion-base")).toMatch(/ms$/);
  });

  it("reflects a universe palette without extra components", () => {
    const { container } = render(
      <ThemeScope theme={{ activeOverrides: [], aesthetic: makeAesthetic() }}>
        <p>hola</p>
      </ThemeScope>,
    );
    const el = container.querySelector<HTMLElement>(".uv");
    expect(el?.getAttribute("data-scheme")).toBe("dark");
    expect(el?.style.getPropertyValue("--uv-color-accent")).toBe(DARK.accent);
    expect(el?.style.getPropertyValue("--uv-font-body")).toBe('"Body Sans", system-ui, sans-serif');
    expect(el?.getAttribute("data-card-transition")).toBe("flip");
  });
});

const PARAMS = [
  {
    id: "off_param_tesoro",
    key: "tesoro",
    name: "Tesoro",
    value: 50,
    min: 0,
    max: 100,
    ratio: 0.5,
    delta: null,
    risk: null,
  },
];

const CARD = {
  id: "c1",
  text: "Una decisión.",
  difficulty: 1,
  options: [
    { id: "o1", order: 0, label: "Uno", kind: "standard" as const, state: "available" as const },
    { id: "o2", order: 1, label: "Dos", kind: "standard" as const, state: "available" as const },
  ],
};

function renderGame(theme: ThemeInput): { outer: string; uv: HTMLElement } {
  const { container } = render(
    <ThemeScope theme={theme}>
      <Hud turn={5} score={10} parameters={PARAMS} powers={[]} icons={{}} />
      <SituationCard card={CARD} mark="D" />
      <OptionList options={CARD.options} onChoose={() => {}} />
    </ThemeScope>,
  );
  const uv = container.querySelector<HTMLElement>(".uv");
  if (uv === null) throw new Error("no .uv");
  const clone = uv.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll<HTMLElement>("[style]")) {
    el.removeAttribute("style");
  }
  return { outer: clone.innerHTML, uv };
}

describe("criterio global: la estética es dato, no componentes", () => {
  it("dos perfiles producen vars distintas con marcado idéntico", () => {
    const a = renderGame({ activeOverrides: [], aesthetic: makeAesthetic() });
    const b = renderGame({ activeOverrides: [], aesthetic: aestheticAlt });

    // El marcado de los componentes es idéntico (sin el atributo style)
    expect(a.outer).toBe(b.outer);

    // Y las variables difieren en colores, fuentes, radios y transición
    expect(a.uv.style.getPropertyValue("--uv-color-accent")).not.toBe(
      b.uv.style.getPropertyValue("--uv-color-accent"),
    );
    expect(a.uv.style.getPropertyValue("--uv-font-body")).not.toBe(
      b.uv.style.getPropertyValue("--uv-font-body"),
    );
    expect(a.uv.style.getPropertyValue("--uv-radius-md")).not.toBe(
      b.uv.style.getPropertyValue("--uv-radius-md"),
    );
    expect(a.uv.getAttribute("data-card-transition")).not.toBe(
      b.uv.getAttribute("data-card-transition"),
    );
  });
});
