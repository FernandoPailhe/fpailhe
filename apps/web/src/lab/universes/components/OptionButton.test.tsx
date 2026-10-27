import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OptionView } from "../application/types";

import { OptionButton } from "./OptionButton";

const OPT: OptionView = { id: "o1", order: 0, label: "Recaudar impuestos", kind: "standard", state: "available" };

describe("OptionButton", () => {
  it("available: calls onChoose with the id and shows the numeral", () => {
    const onChoose = vi.fn();
    render(<OptionButton option={OPT} index={0} onChoose={onChoose} />);
    const btn = screen.getByRole("button", { name: /Recaudar impuestos/ });
    expect(btn.textContent).toContain("1");
    fireEvent.click(btn);
    expect(onChoose).toHaveBeenCalledWith("o1");
  });

  it("locked: aria-disabled, shows reason and glyph, click does nothing", () => {
    const onChoose = vi.fn();
    const locked: OptionView = { ...OPT, state: "locked", lockedReason: "Requiere: Consejo sabio" };
    render(<OptionButton option={locked} index={1} onChoose={onChoose} />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Requiere: Consejo sabio")).toBeTruthy();
    expect(btn.textContent).toContain("⊘");
    fireEvent.click(btn);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("balance kind shows the EQUILIBRIO label", () => {
    render(<OptionButton option={{ ...OPT, kind: "balance" }} index={0} onChoose={() => {}} />);
    expect(screen.getByText("EQUILIBRIO")).toBeTruthy();
  });
});
