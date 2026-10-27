import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StartScreen } from "./StartScreen";

const base = { title: "Demo Reino", description: "Un reino de prueba." };

function renderStart(game: Parameters<typeof StartScreen>[0]["game"], handlers = {}) {
  const h = {
    onPlay: vi.fn(),
    onContinue: vi.fn(),
    onNew: vi.fn(),
    onSeeEnd: vi.fn(),
    ...handlers,
  };
  render(<StartScreen game={game} {...h} />);
  return h;
}

describe("StartScreen", () => {
  it("sin partida guardada muestra solo Jugar", () => {
    const h = renderStart({ ...base, phase: "no_session", hasSavedSession: false });
    fireEvent.click(screen.getByRole("button", { name: "Jugar" }));
    expect(h.onPlay).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
  });

  it("con partida guardada muestra Continuar y Nueva partida con confirmación", () => {
    const h = renderStart({ ...base, phase: "card", hasSavedSession: true });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(h.onContinue).toHaveBeenCalled();

    const newBtn = screen.getByRole("button", { name: "Nueva partida" });
    fireEvent.click(newBtn); // arma
    expect(h.onNew).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /¿Seguro\?/ }));
    expect(h.onNew).toHaveBeenCalled();
  });

  it("Escape cancela la confirmación de dos pasos", () => {
    const h = renderStart({ ...base, phase: "card", hasSavedSession: true });
    const btn = screen.getByRole("button", { name: "Nueva partida" });
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Nueva partida" })).toBeTruthy();
    expect(h.onNew).not.toHaveBeenCalled();
  });

  it("partida terminada muestra Ver final y Nueva partida sin confirmación", () => {
    const h = renderStart({ ...base, phase: "ended", hasSavedSession: false });
    fireEvent.click(screen.getByRole("button", { name: "Ver final" }));
    expect(h.onSeeEnd).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Nueva partida" }));
    expect(h.onNew).toHaveBeenCalled();
  });
});
