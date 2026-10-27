import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EndView } from "../application/types";

import { EndScreen } from "./EndScreen";

const END: EndView = {
  result: "victory",
  title: "Coronación",
  text: "El pueblo te aclama.\nFin.",
  turns: 12,
  score: 340,
  stageName: "Coronación",
  badges: [{ id: "b1", name: "Coronado" }],
  parameters: [
    { id: "p1", key: "tesoro", name: "Tesoro", value: 42, min: 0, max: 100, ratio: 0.42, delta: null, risk: null },
  ],
};

describe("EndScreen", () => {
  it("muestra el resultado como etiqueta de texto + glifo", () => {
    render(<EndScreen end={END} onPlayAgain={() => {}} />);
    expect(screen.getByText("VICTORIA")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Coronación" })).toBeTruthy();
    expect(screen.getByText(/Turnos/)).toBeTruthy();
    expect(screen.getByText("Coronado")).toBeTruthy();
    expect(screen.getByText("Tesoro: 42")).toBeTruthy();
  });

  it("etiqueta de derrota", () => {
    render(<EndScreen end={{ ...END, result: "defeat" }} onPlayAgain={() => {}} />);
    expect(screen.getByText("DERROTA")).toBeTruthy();
  });
});
