import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DifficultySelector } from "./DifficultySelector";

describe("DifficultySelector", () => {
  it("marca la opción activa con aria-checked", () => {
    render(<DifficultySelector value="easy" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Easy" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "false");
  });

  it("clic en Medium llama onChange('medium')", () => {
    const onChange = vi.fn();
    render(<DifficultySelector value="easy" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    expect(onChange).toHaveBeenCalledWith("medium");
  });

  it("ofrece Hard y el clic llama onChange('hard')", () => {
    const onChange = vi.fn();
    render(<DifficultySelector value="easy" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    expect(onChange).toHaveBeenCalledWith("hard");
  });

  it("muestra el hint de la opción seleccionada", () => {
    const { rerender } = render(<DifficultySelector value="easy" onChange={() => {}} />);
    expect(screen.getByText(/quick, imperfect/i)).toBeInTheDocument();
    rerender(<DifficultySelector value="medium" onChange={() => {}} />);
    expect(screen.getByText(/one reply ahead/i)).toBeInTheDocument();
  });
});
