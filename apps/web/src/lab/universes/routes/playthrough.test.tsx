import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { UniversesLayout } from "../components";

import { UniverseEndPage } from "./UniverseEndPage";
import { UniversePage } from "./UniversePage";
import { UniversePlayPage } from "./UniversePlayPage";
import { UniversesIndexPage } from "./UniversesIndexPage";

/**
 * Playthrough de `demo-reino` en jsdom (task 08): lista → inicio → carta →
 * resultado → siguiente carta → abandono → final, solo con la UI pública.
 */
function mountApp(initial = "/lab/universes") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/lab/universes" element={<UniversesLayout />}>
            <Route index element={<UniversesIndexPage />} />
            <Route path=":slug" element={<UniversePage />} />
            <Route path=":slug/jugar" element={<UniversePlayPage />} />
            <Route path=":slug/final" element={<UniverseEndPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function options(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".uv-option")];
}

describe("playthrough demo-reino", () => {
  it("lista → universo → jugar → outcome → siguiente carta → abandonar → final", async () => {
    mountApp();

    // Lista de universos tematizada con la plataforma
    const enter = await screen.findByRole("link", { name: "Entrar" });
    fireEvent.click(enter);

    // Inicio: Jugar
    const play = await screen.findByRole("button", { name: "Jugar" }, { timeout: 5000 });
    fireEvent.click(play);

    // Fase card: HUD + opciones
    await waitFor(() => expect(options().length).toBeGreaterThan(0), { timeout: 5000 });
    expect(document.querySelectorAll('[role="meter"]').length).toBeGreaterThan(0);
    fireEvent.click(options()[0]!);

    // Fase outcome: resultado + continuar (foco en el botón)
    await waitFor(() => expect(document.querySelector(".uv-outcome")).not.toBeNull(), { timeout: 5000 });
    const cont = await screen.findByRole("button", { name: /Continuar|Ver final/ });
    expect(document.activeElement).toBe(cont);
    fireEvent.click(cont);

    // Siguiente turno (o final si la partida terminó)
    await waitFor(
      () =>
        expect(
          options().length > 0 || document.querySelector(".uv-end") !== null,
        ).toBe(true),
      { timeout: 5000 },
    );

    // Abandonar (dos pasos) o ya terminada
    const abandon = screen.queryByRole("button", { name: "Abandonar partida" });
    if (abandon) {
      fireEvent.click(abandon);
      fireEvent.click(await screen.findByRole("button", { name: /¿Seguro\?/ }));
      await waitFor(
        () => expect(document.querySelector(".uv-end")).not.toBeNull(),
        { timeout: 5000 },
      );
      expect(screen.getByText("ABANDONADA")).toBeTruthy();
    }
  }, 20000);
});
