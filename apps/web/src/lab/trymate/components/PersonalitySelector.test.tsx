import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PersonalitySelector } from "./PersonalitySelector";

describe("PersonalitySelector", () => {
  it("ofrece las 3 personalidades como radio group", () => {
    render(<PersonalitySelector value="balanced" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Computer personality" });
    expect(group).toBeInTheDocument();
    for (const name of ["Balanced", "Offensive", "Defensive"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Balanced" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Offensive" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("clic en Offensive llama onChange('offensive')", () => {
    const onChange = vi.fn();
    render(<PersonalitySelector value="balanced" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Offensive" }));
    expect(onChange).toHaveBeenCalledWith("offensive");
  });

  it("muestra el hint de la personalidad seleccionada", () => {
    const { rerender } = render(<PersonalitySelector value="balanced" onChange={() => {}} />);
    expect(screen.getByText(/attacks when ahead/i)).toBeInTheDocument();
    rerender(<PersonalitySelector value="defensive" onChange={() => {}} />);
    expect(screen.getByText(/builds a wall/i)).toBeInTheDocument();
  });
});
