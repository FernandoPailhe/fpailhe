import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, useThemeOverride } from "@ferpa/ui";
import { Nav } from "../../components";
import { TryMateBoard } from "./components/TryMateBoard";
import { PiecePickerDialog } from "./components/PiecePickerDialog";
import { BenchPieceDialog } from "./components/BenchPieceDialog";
import { BenchPanel } from "./components/BenchPanel";
import { GameSidebar } from "./components/GameSidebar";
import { GameOverPanel } from "./components/GameOverPanel";
import { useBoardSize } from "./lib/useBoardSize";
import { RoomLobby } from "./components/RoomLobby";
import { RulesPanel } from "./components/RulesPanel";
import { SetupModeSelector } from "./components/SetupModeSelector";
import { SetupPassScreen } from "./components/SetupPassScreen";
import { useGameStore } from "./application/GameState";
import { useComputerTurn } from "./application/useComputerTurn";
import { useRoomStore } from "./application/RoomState";
import { createFirebaseRoomsGateway } from "./infrastructure/firebase/FirebaseRoomsGateway";
import { GameMode, GamePhase, SetupTurnMode } from "./domain/constants/GameRules";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "CV", href: "/cv" },
];

type Screen = "menu" | "online" | "local";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/**
 * Página del módulo trymate (ruta `/lab/trymate`).
 * Módulo independiente: su dominio y componentes viven en esta carpeta.
 * Arranca en una pantalla de inicio: "Play online" abre el lobby de salas,
 * "Play local 1v1" va directo al comienzo del partido. Un `?room=<id>` en la
 * URL entra directo al lobby para conservar el auto-join por link.
 */
export function TryMatePage() {
  // TryMate es siempre dark (issue #16): el override se revierte al salir.
  useThemeOverride("dark");
  // No-op fuera de VS_COMPUTER; agenda los turnos del bot cuando corresponde.
  useComputerTurn();
  const gamePhase = useGameStore((s) => s.gamePhase);
  const setupMode = useGameStore((s) => s.setupMode);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const gameMode = useGameStore((s) => s.gameMode);
  const isSetupTurnForLocalPlayer = useGameStore((s) => s.isSetupTurnForLocalPlayer);
  const roomStatus = useRoomStore((s) => s.status);
  const [params] = useSearchParams();
  const [screen, setScreen] = useState<Screen>(() => (params.get("room") ? "online" : "menu"));
  const [showRules, setShowRules] = useState(false);
  const [menuSetupMode, setMenuSetupMode] = useState<SetupTurnMode>(SetupTurnMode.ALTERNATING);

  // Composition root: inyecta el adaptador concreto del puerto RoomsGateway.
  // Sin credenciales devuelve null → el lobby avisa y el modo local sigue.
  useEffect(() => {
    useRoomStore.getState().setGateway(createFirebaseRoomsGateway());
  }, []);

  const goLocal = () => {
    useGameStore.getState().reset(menuSetupMode);
    setSetupPassAcknowledged(true);
    setScreen("local");
  };

  const goVsComputer = () => {
    useGameStore.getState().startVsComputer(menuSetupMode);
    setSetupPassAcknowledged(true);
    setScreen("local");
  };

  const backToMenu = () => {
    void useRoomStore.getState().leaveRoom();
    useGameStore.getState().reset();
    setScreen("menu");
  };

  const showGame = screen === "local" || (screen === "online" && roomStatus === "connected");

  // Setup oculto: el tablero solo se muestra al jugador que configura. En
  // local PVP además hay que confirmar el pase de dispositivo; el flag se
  // reinicia cada vez que cambia el jugador que configura.
  const isHiddenSetup = gamePhase === GamePhase.SETUP && setupMode === SetupTurnMode.HIDDEN;
  const isLocalPVP = gameMode === GameMode.PVP;
  const [setupPassAcknowledged, setSetupPassAcknowledged] = useState(true);
  const prevPlayerRef = useRef(currentPlayer);
  useEffect(() => {
    if (isHiddenSetup && isLocalPVP && prevPlayerRef.current !== currentPlayer) {
      setSetupPassAcknowledged(false);
    }
    prevPlayerRef.current = currentPlayer;
  }, [currentPlayer, isHiddenSetup, isLocalPVP]);

  const showHiddenBoard = isSetupTurnForLocalPlayer() && (!isLocalPVP || setupPassAcknowledged);
  const showBoard = !isHiddenSetup || showHiddenBoard;

  // Columna del tablero: su ancho determina el segundo límite del tamaño del
  // board (el primero es el 90 % del alto de ventana) y el alto máximo del
  // sidebar. Callback ref porque la columna solo se monta con `showGame`.
  const [boardColumnEl, setBoardColumnEl] = useState<HTMLDivElement | null>(null);
  const boardSize = useBoardSize(boardColumnEl);

  return (
    <>
      <Nav links={NAV_LINKS} hideThemeToggle />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex max-w-[880px] flex-col gap-6 px-[clamp(20px,5vw,32px)] py-10"
      >
        <header>
          <p className="font-ui text-xs uppercase tracking-widest text-gold-bright">Lab</p>
          <h1 className="font-display text-3xl font-bold text-ink">TryMate</h1>
          <p className="mt-2 text-ink-dim">
            Experimental module: chess-like tactics on a 5×11 rugby field.
          </p>
          <button
            type="button"
            aria-expanded={showRules}
            onClick={() => setShowRules((v) => !v)}
            className={`mt-3 font-ui text-xs text-gold-bright underline underline-offset-2 hover:text-gold ${FOCUS}`}
          >
            {showRules ? "Hide rules" : "How to play / Reglas"}
          </button>
        </header>

        {showRules && <RulesPanel />}

        {screen === "menu" && (
          <section
            aria-label="Choose game mode"
            className="mx-auto flex w-full max-w-[420px] flex-col gap-3 border border-line bg-surface px-6 py-5"
          >
            <Button type="button" onClick={() => setScreen("online")}>
              Play online
            </Button>
            <SetupModeSelector value={menuSetupMode} onChange={setMenuSetupMode} />
            <Button type="button" onClick={goLocal}>
              Play local 1v1
            </Button>
            <Button type="button" onClick={goVsComputer}>
              Play vs computer (Easy)
            </Button>
          </section>
        )}

        {screen === "online" && <RoomLobby />}

        {screen !== "menu" && (
          <div className="mx-auto w-full max-w-[420px]">
            <button
              type="button"
              onClick={backToMenu}
              className={`font-ui text-xs text-ink-dim underline underline-offset-2 hover:text-ink ${FOCUS}`}
            >
              Back to menu
            </button>
          </div>
        )}

        {showGame && showBoard && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] items-start gap-6 mobile:grid-cols-1">
            <div
              ref={setBoardColumnEl}
              className="flex min-w-0 flex-col items-end gap-4 mobile:items-center"
            >
              <TryMateBoard />
              {gamePhase === GamePhase.PLAYING && <BenchPanel width={boardSize.boardWidth} />}
              {gamePhase === GamePhase.GAME_OVER && <GameOverPanel />}
            </div>
            <GameSidebar maxHeight={boardSize.boardHeight} />
          </div>
        )}

        {showGame && isHiddenSetup && !showHiddenBoard && (
          <SetupPassScreen
            waitingFor={currentPlayer}
            localMode={isLocalPVP}
            onContinue={() => setSetupPassAcknowledged(true)}
          />
        )}
      </main>
      {showGame && showBoard && <PiecePickerDialog />}
      {showGame && showBoard && <BenchPieceDialog />}
    </>
  );
}
