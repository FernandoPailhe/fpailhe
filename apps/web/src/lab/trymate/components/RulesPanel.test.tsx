import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RulesPanel } from "./RulesPanel";
import { useUiPrefsStore } from "../application/uiPrefs";
import { buildRulesContent } from "../lib/rulesContent";
import { buildRulesView } from "../domain/config/RulesView";
import { GAME_RULES } from "../domain/constants/GameRules";

describe("RulesPanel", () => {
  it("renders the rules in English by default, with a diagram per piece", () => {
    render(<RulesPanel />);
    expect(screen.getByRole("region", { name: "How to play" })).toBeInTheDocument();
    expect(screen.getByText(/first player to 3 points wins/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /movement example/ })).toHaveLength(3);
  });

  it("renders the movement diagrams with board-like squares", () => {
    render(<RulesPanel />);
    for (const diagram of screen.getAllByRole("img", { name: /movement example/ })) {
      const cells = Array.from(diagram.children) as HTMLElement[];
      expect(cells).toHaveLength(25);
      for (const cell of cells) {
        expect(cell.className.includes("bg-pitch") || cell.className.includes("bg-pitch-alt")).toBe(
          true,
        );
      }
    }
  });

  it("switches to Spanish and back", () => {
    useUiPrefsStore.getState().setRulesLang("en");
    render(<RulesPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(screen.getByRole("region", { name: "Cómo jugar" })).toBeInTheDocument();
    expect(screen.getByText(/gana el primero en llegar a 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("region", { name: "How to play" })).toBeInTheDocument();
  });

  it("buildRulesContent genera los números desde una variante de reglas", () => {
    const wide = buildRulesView(
      { BOARD_WIDTH: 7, BOARD_HEIGHT: 13 },
      { ...GAME_RULES, PLACEMENT_DEPTH: 2 },
    );
    const content = buildRulesContent(wide);
    expect(content.en.board).toContain("7 columns × 13 rows");
    expect(content.en.board).toContain("rows 2–3 (White) or 11–12 (Black)");
    expect(content.en.board).toContain("row 13 for White, row 1 for Black");
    expect(content.es.board).toContain("filas 2–3 (Blancas) u 11–12 (Negras)");
    expect(content.en.objective).toContain("7×13");
  });
});
