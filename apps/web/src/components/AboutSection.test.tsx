import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AboutSection } from "./AboutSection";

describe("AboutSection", () => {
  it("renders the photo when it loads", () => {
    render(<AboutSection text="About text" photo="fernando-photo.jpg" />);
    expect(screen.getByAltText("Portrait of Fernando Pailhe")).toBeInTheDocument();
    expect(screen.queryByLabelText(/FP initials avatar/i)).not.toBeInTheDocument();
  });

  it("renders initials avatar when photo fails to load", () => {
    render(<AboutSection text="About text" photo="missing.jpg" />);

    const img = screen.getByAltText("Portrait of Fernando Pailhe");
    fireEvent.error(img);

    expect(screen.getByLabelText(/FP initials avatar/i)).toBeInTheDocument();
    expect(screen.queryByAltText("Portrait of Fernando Pailhe")).not.toBeInTheDocument();
  });
});
