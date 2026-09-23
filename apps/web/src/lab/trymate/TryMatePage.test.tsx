import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@ferpa/ui";
import { TryMatePage } from "./TryMatePage";
import { useGameStore } from "./application/GameState";
import { useRoomStore } from "./application/RoomState";
import { PieceType, Player } from "./domain/constants/PieceConstants";
import { GameMode } from "./domain/constants/GameRules";

// ThemeProvider llama window.matchMedia; jsdom no lo implementa — stub
// mínimo antes de montar (mismo patrón que App.test.tsx).
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

beforeEach(() => {
  useGameStore.getState().reset();
  useRoomStore.setState({
    status: "idle",
    roomId: null,
    role: null,
    rooms: [],
    error: null,
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TryMatePage />
    </MemoryRouter>,
  );
}

describe("TryMatePage", () => {
  it("shows no piece picker on the menu", () => {
    renderPage();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not flash the piece picker when entering the online lobby (issue #14)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers play vs computer and starts a VS_COMPUTER game with the board", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play vs computer/i }));
    expect(useGameStore.getState().gameMode).toBe(GameMode.VS_COMPUTER);
    expect(useGameStore.getState().localPlayer).toBe(Player.BLANCAS);
    expect(screen.getByRole("grid", { name: "TryMate board" })).toBeInTheDocument();
  });

  it("still opens the setup picker for local play", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play local/i }));
    expect(screen.getByRole("dialog", { name: "Choose your piece" })).toBeInTheDocument();
  });

  it("opens the picker online only when connected and it is the local turn", () => {
    useGameStore.getState().setOnlineContext("room-1", Player.BLANCAS);
    useRoomStore.setState({ status: "connected", roomId: "room-1", role: "host" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));
    expect(screen.getByRole("dialog", { name: "Choose your piece" })).toBeInTheDocument();
  });

  it("keeps the picker closed online when it is the opponent's turn", () => {
    useGameStore.getState().setOnlineContext("room-1", Player.NEGRAS);
    useRoomStore.setState({ status: "connected", roomId: "room-1", role: "guest" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("quick-start online muestra el tablero sin picker de setup ni bench", () => {
    useGameStore.getState().prepareOnlineGame("quick");
    useGameStore.getState().setOnlineContext("room-1", Player.NEGRAS);
    useRoomStore.setState({ status: "connected", roomId: "room-1", role: "guest" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));
    expect(screen.getByRole("grid", { name: "TryMate board" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("manual setup online: el host elige pieza, se cierra el modal y quedan destinos", () => {
    useGameStore.getState().prepareOnlineGame("manual");
    useGameStore.getState().setOnlineContext("room-1", Player.BLANCAS);
    useRoomStore.setState({ status: "connected", roomId: "room-1", role: "host" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /play online/i }));

    const dialog = screen.getByRole("dialog", { name: "Choose your piece" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Fort/ }));

    expect(useGameStore.getState().selectedPieceTypeForPlacement).toBe(PieceType.FORT);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useGameStore.getState().validMoves.length).toBeGreaterThan(0);
  });

  it("always renders in dark mode and restores the theme on unmount (issue #16)", () => {
    // El provider queda montado al salir de la página (como en la app real):
    // el override se limpia y el tema vuelve al del usuario/sistema.
    function Harness({ show }: { show: boolean }) {
      return (
        <ThemeProvider>
          <MemoryRouter>{show ? <TryMatePage /> : null}</MemoryRouter>
        </ThemeProvider>
      );
    }
    const { rerender } = render(<Harness show={true} />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    rerender(<Harness show={false} />);
    // El stub devuelve matches:false → sistema light → el restore resuelve light.
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
