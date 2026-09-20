import { describe, expect, it, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@ferpa/ui";
import { App } from "./App";

// ThemeProvider llama window.matchMedia en un useEffect; jsdom no lo
// implementa — stub mínimo antes de montar.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
});

function renderAt(route: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("App router", () => {
  it("mounts TryMatePage at /lab/trymate", () => {
    renderAt("/lab/trymate");
    expect(screen.getByRole("heading", { name: "TryMate" })).toBeInTheDocument();
  });

  it("renders the app 404 for unknown routes", () => {
    renderAt("/definitely-not-a-route");
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });
});
