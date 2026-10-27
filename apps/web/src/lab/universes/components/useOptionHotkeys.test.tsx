import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OptionView } from "../application/types";

import { useOptionHotkeys } from "./useOptionHotkeys";

const OPTIONS: OptionView[] = [
  { id: "a", order: 0, label: "Uno", kind: "standard", state: "available" },
  { id: "b", order: 1, label: "Dos", kind: "standard", state: "locked" },
  { id: "c", order: 2, label: "Tres", kind: "standard", state: "available" },
];

function Harness({ enabled = true }: { enabled?: boolean }) {
  useOptionHotkeys(OPTIONS, (window as { __choose?: (id: string) => void }).__choose ?? (() => {}), enabled);
  return <input data-testid="campo" />;
}

describe("useOptionHotkeys", () => {
  it("digits 1–3 choose the matching available option", () => {
    const choose = vi.fn();
    (window as { __choose?: typeof choose }).__choose = choose;
    render(<Harness />);
    fireEvent.keyDown(window, { key: "1" });
    expect(choose).toHaveBeenCalledWith("a");
    fireEvent.keyDown(window, { key: "3" });
    expect(choose).toHaveBeenCalledWith("c");
  });

  it("locked options are skipped", () => {
    const choose = vi.fn();
    (window as { __choose?: typeof choose }).__choose = choose;
    render(<Harness />);
    fireEvent.keyDown(window, { key: "2" });
    expect(choose).not.toHaveBeenCalled();
  });

  it("ignores keys inside inputs and modifiers", () => {
    const choose = vi.fn();
    (window as { __choose?: typeof choose }).__choose = choose;
    render(<Harness />);
    const input = screen.getByTestId("campo");
    fireEvent.keyDown(input, { key: "1" });
    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    expect(choose).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const choose = vi.fn();
    (window as { __choose?: typeof choose }).__choose = choose;
    renderHook(() => useOptionHotkeys(OPTIONS, choose, false));
    fireEvent.keyDown(window, { key: "1" });
    expect(choose).not.toHaveBeenCalled();
  });
});
