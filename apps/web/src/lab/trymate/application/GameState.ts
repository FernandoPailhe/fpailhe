import { create, type StateCreator } from "zustand";
import { Board } from "../domain/entities/Board";
import { Position } from "../domain/entities/Position";
import { GamePiece } from "../domain/entities/GamePiece";
import { PlayerState } from "../domain/entities/PlayerState";
import { IGameState } from "../domain/interfaces/IGameState";
import { GAME_CONFIG } from "../domain/constants/GameConstants";
import { Player, PieceType } from "../domain/constants/PieceConstants";
import {
  GamePhase,
  GAME_RULES,
  GameMode,
  SetupTurnMode,
  type RoomSetupMode,
} from "../domain/constants/GameRules";
import { MovementRuleEngine } from "./rules/MovementRuleEngine";
import {
  canPlaceFromBench,
  getBenchPlacementSquares,
  hasAnyLegalAction,
  hasAnyLegalMove,
} from "./rules/turnRules";
import {
  createComputerPlayer,
  loadComputerPlayer,
  needsAsyncLoad,
  type BotContext,
  type BotDifficulty,
  type BotPlayAction,
  type ComputerPlayer,
} from "./ai/ComputerPlayer";
import type { Personality } from "./ai/personality";
import type { Rng } from "./ai/rng";
import {
  resolveQuickStartLayout,
  type QuickStartLayoutSelection,
} from "../domain/config/QuickStartLayout";
import { CURRENT_RULES } from "../domain/config/RulesView";
import { countsOf, feasibleTypes } from "../domain/rules/composition";
import { generateRandomArmy } from "../domain/rules/randomArmy";
import { MoveHistory, MoveRecord } from "../domain/entities/MoveHistory";
import {
  boardFromPieceSnapshots,
  deserializeGameSnapshot,
  serializeGameSnapshot,
  type GameSnapshot,
  type PieceSnapshot,
} from "../domain/entities/GameSnapshot";

interface GameStateStore {
  board: Board;
  gamePhase: GamePhase;
  gameMode: GameMode;
  currentPlayer: Player;
  player1State: PlayerState;
  player2State: PlayerState;
  selectedPiece: GamePiece | null;
  selectedPieceTypeForPlacement: PieceType | null;
  selectedBenchPiece: GamePiece | null;
  validMoves: Position[];
  blockedMoves: Position[];
  movementEngine: MovementRuleEngine;
  pieceIdCounter: number;
  moveHistory: MoveHistory;
  isViewingHistory: boolean;
  /** Bando que controla este cliente en ONLINE; null = modo local. */
  localPlayer: Player | null;
  roomId: string | null;
  /** Modo de turnos del setup: alternado (default) u oculto por jugador. */
  setupMode: SetupTurnMode;
  /** Progreso del setup en modo HIDDEN (sin efecto en ALTERNATING). */
  setupCompleted: { player1: boolean; player2: boolean };
  /** Jugador que está configurando en modo HIDDEN (BLANCAS primero). */
  setupPlayer: Player;
  /** Último jugador que pasó el turno por no tener acciones legales (aviso UI). */
  lastPassedPlayer: Player | null;
  /** Dificultad del bot en VS_COMPUTER. */
  botDifficulty: BotDifficulty;
  /** Controller del bot de la partida actual; null fuera de VS_COMPUTER. */
  botController: ComputerPlayer | null;
  /** Id del controller actual: sube cada vez que se crea uno (invalida turnos async). */
  botControllerId: number;
  /** True mientras un bot async calcula su turno (búsqueda en worker). */
  botThinking: boolean;
  /** Personalidad del bot (solo Hard la usa hoy). */
  botPersonality: Personality;
  /** True mientras se descarga/crea el controller lazy (Hard). */
  botLoading: boolean;

  selectPieceTypeForSetup: (type: PieceType) => void;
  selectPieceTypeForBench: (type: PieceType) => void;
  placePieceInSetup: (position: Position) => void;
  placeBenchPiece: (position: Position) => void;
  selectBenchPiece: (benchPiece: GamePiece) => void;
  selectTile: (position: Position) => void;
  handleTileClick: (position: Position) => void;
  hoverTile: (position: Position | null) => void;
  movePiece: (to: Position) => void;
  startGame: () => void;
  reset: (setupMode?: SetupTurnMode) => void;
  /**
   * Inicia una partida local con ejércitos predeterminados. Sin ids, cada
   * equipo sortea un layout del JSON de configuración (pueden repetirse).
   */
  quickStart: (player1LayoutId?: string, player2LayoutId?: string) => void;
  /** Prepara el estado inicial de una sala online de forma determinista. */
  prepareOnlineGame: (
    setupMode: RoomSetupMode,
    setupTurnMode?: SetupTurnMode,
    quickStartLayouts?: QuickStartLayoutSelection,
  ) => void;
  /** Cambia el modo de turnos del setup; solo válido antes de colocar piezas. */
  setSetupMode: (mode: SetupTurnMode) => void;
  /** Inicia partida contra la computadora: humano BLANCAS, bot NEGRAS. */
  startVsComputer: (
    setupMode: SetupTurnMode,
    difficulty?: BotDifficulty,
    personality?: Personality,
  ) => void;
  /** Reinicia la partida conservando el modo actual (PVP / VS_COMPUTER). */
  playAgain: () => void;
  /** Bando que controla el bot en VS_COMPUTER; null en otros modos. */
  getBotPlayer: () => Player | null;
  /**
   * Ejecuta UNA acción atómica del bot (setup, banca o jugada) reutilizando
   * las acciones públicas. Devuelve true si el estado cambió.
   */
  runBotTurn: (rng?: Rng) => boolean;
  /**
   * Variante async: usa `choosePlayActionAsync`/`prepareSetupAsync` si el
   * controller los tiene (Hard); si no, cae a `runBotTurn`. Descarta la
   * respuesta si el turno cambió mientras pensaba (token) o se abortó.
   */
  runBotTurnAsync: (signal: AbortSignal, rng?: Rng) => Promise<boolean>;
  /**
   * Contexto del bot para este instante; null si no es turno del bot, fase
   * inválida o se está viendo el historial. Incluye el filtro HIDDEN.
   */
  buildBotContext: (rng?: Rng) => BotContext | null;
  /**
   * Aplica UNA acción de PLAYING del bot (banca, movimiento o pase) por las
   * acciones públicas. Devuelve true si el estado cambió.
   */
  applyBotAction: (action: BotPlayAction) => boolean;
  /**
   * Huella del turno actual: cambia con fase, turno, movimientos, banca,
   * historial, sala y controller. Un resultado async cuyo token ya no
   * coincide se descarta (llegó tarde a una partida distinta).
   */
  getBotTurnToken: () => string;
  /** True si el jugador local debe ver/actuar en el setup (siempre true en local). */
  isSetupTurnForLocalPlayer: () => boolean;
  getCurrentPlayerState: () => PlayerState;
  getOpponentPlayerState: () => PlayerState;
  checkScoring: (piece: GamePiece) => void;
  checkGameOver: () => void;
  /**
   * Resuelve un turno sin salida en PLAYING: si el jugador de turno no puede
   * mover ni bajar banca, pasa al rival (y lo marca en `lastPassedPlayer`);
   * si ninguno puede, termina la partida.
   */
  resolveStalledTurn: () => void;
  canSelectPieceType: (type: PieceType) => boolean;
  canSelectBenchPieceType: (type: PieceType) => boolean;
  canPlaceBenchPiece: () => boolean;
  setGameMode: (mode: GameMode) => void;
  goBackInHistory: () => void;
  goForwardInHistory: () => void;
  returnToPresent: () => void;
  getMoveHistory: () => MoveRecord[];
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  isLocalPlayerTurn: () => boolean;
  setOnlineContext: (roomId: string | null, localPlayer: Player | null) => void;
  applyRemoteSnapshot: (snapshot: GameSnapshot) => void;
  toSnapshot: () => GameSnapshot;
}

const createInitialBoard = (): Board => {
  return new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
};

function restoreBoardFromSnapshot(json: string): Board {
  return boardFromPieceSnapshots(JSON.parse(json) as PieceSnapshot[]);
}

/**
 * Tablero que solo contiene las piezas de `owner` (clones): lo que el bot
 * puede ver durante el setup HIDDEN.
 */
function boardWithOnlyOwner(board: Board, owner: Player): Board {
  const filtered = new Board(board.width, board.height);
  for (const piece of board.getAllPieces()) {
    if (piece.owner === owner) filtered.addPiece(piece.clone());
  }
  return filtered;
}

interface InitialGameState {
  board: Board;
  player1State: PlayerState;
  player2State: PlayerState;
  pieceIdCounter: number;
}

/** Estado fresco para setup manual: tablero vacío y contadores en cero. */
function buildManualStartState(): InitialGameState {
  return {
    board: createInitialBoard(),
    player1State: new PlayerState("player1"),
    player2State: new PlayerState("player2"),
    pieceIdCounter: 0,
  };
}

/**
 * Arma los ejércitos de quick start desde los layouts del JSON de
 * configuración (`domain/config/quickstart-layouts.json`). Sin ids en
 * `selection`, cada equipo sortea un layout independiente — puede tocar el
 * mismo o distinto. Si no quedan layouts válidos para las reglas vigentes
 * (o el id pedido no existe), cae a un ejército generado por
 * `generateRandomArmy`. Compartido entre `quickStart` (local) y
 * `prepareOnlineGame("quick")` para que ambos modos no dupliquen la
 * disposición ni los contadores.
 */
function buildQuickStartState(selection: QuickStartLayoutSelection = {}): InitialGameState {
  const board = createInitialBoard();
  const player1State = new PlayerState("player1");
  const player2State = new PlayerState("player2");
  let pieceCounter = 0;

  const applyLayout = (
    player: Player,
    playerState: PlayerState,
    idPrefix: string,
    layoutId?: string,
  ): void => {
    const army =
      resolveQuickStartLayout(player, layoutId) ??
      generateRandomArmy(CURRENT_RULES, player, Math.random);
    army.boardPieces.forEach(({ type, position }) => {
      const piece = new GamePiece(`${idPrefix}-${pieceCounter++}`, type, position, player);
      board.addPiece(piece);
      playerState.addSelectedPiece(type);
      playerState.addPlacedPiece(piece);
    });
    army.benchPieces.forEach((type) => {
      const benchPiece = new GamePiece(`${idPrefix}-bench-${pieceCounter++}`, type, null, player);
      playerState.addBenchPiece(benchPiece);
    });
  };

  applyLayout(Player.BLANCAS, player1State, "p1", selection.player1);
  applyLayout(Player.NEGRAS, player2State, "p2", selection.player2);

  return { board, player1State, player2State, pieceIdCounter: pieceCounter };
}

const gameStoreInitializer: StateCreator<GameStateStore> = (set, get) => {
  // Flag interno (no reactivo): mientras el bot ejecuta su acción, las
  // validaciones de "turno local" lo dejan pasar. Siempre vuelve a false.
  let botActing = false;

  /** Devuelve el controller vigente o crea uno sync; null mientras carga (Hard). */
  const ensureController = (rng: Rng): ComputerPlayer | null => {
    const s = get();
    if (s.botController) return s.botController;
    if (needsAsyncLoad(s.botDifficulty)) return null; // carga lazy en curso
    const controller = createComputerPlayer(s.botDifficulty, rng, {
      personality: s.botPersonality,
    });
    set({ botController: controller, botControllerId: s.botControllerId + 1 });
    return controller;
  };

  return {
    board: createInitialBoard(),
    gamePhase: GamePhase.SETUP,
    gameMode: GameMode.PVP,
    currentPlayer: Player.BLANCAS,
    player1State: new PlayerState("player1"),
    player2State: new PlayerState("player2"),
    selectedPiece: null,
    selectedPieceTypeForPlacement: null,
    selectedBenchPiece: null,
    validMoves: [],
    blockedMoves: [],
    movementEngine: new MovementRuleEngine(),
    pieceIdCounter: 0,
    moveHistory: new MoveHistory(),
    isViewingHistory: false,
    localPlayer: null,
    roomId: null,
    setupMode: SetupTurnMode.ALTERNATING,
    setupCompleted: { player1: false, player2: false },
    setupPlayer: Player.BLANCAS,
    lastPassedPlayer: null,
    botDifficulty: "easy",
    botController: null,
    botControllerId: 0,
    botThinking: false,
    botPersonality: "balanced",
    botLoading: false,

    isLocalPlayerTurn: () => {
      if (botActing) return true;
      const state = get();
      return (
        state.gameMode === GameMode.PVP ||
        state.localPlayer === null ||
        state.localPlayer === state.currentPlayer
      );
    },

    isSetupTurnForLocalPlayer: () => {
      if (botActing) return true;
      const state = get();
      if (state.gameMode === GameMode.PVP || state.localPlayer === null) return true;
      return state.currentPlayer === state.localPlayer;
    },

    startVsComputer: (
      setupMode: SetupTurnMode,
      difficulty?: BotDifficulty,
      personality?: Personality,
    ) => {
      const s = get();
      const botDifficulty = difficulty ?? s.botDifficulty;
      const botPersonality = personality ?? s.botPersonality;
      s.reset(setupMode); // también hace dispose del controller anterior
      const controllerId = get().botControllerId + 1;
      set({
        gameMode: GameMode.VS_COMPUTER,
        localPlayer: Player.BLANCAS,
        roomId: null,
        botDifficulty,
        botPersonality,
        botControllerId: controllerId,
      });
      if (needsAsyncLoad(botDifficulty)) {
        // Carga diferida: el chunk de Hard se descarga recién acá.
        set({ botController: null, botLoading: true });
        void loadComputerPlayer(botDifficulty, Math.random, { personality: botPersonality })
          .then((controller) => {
            const cur = get();
            if (cur.botControllerId === controllerId && cur.gameMode === GameMode.VS_COMPUTER) {
              set({ botController: controller, botLoading: false });
            } else {
              controller.dispose?.();
            }
          })
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.error("startVsComputer: no se pudo cargar el bot", err);
            }
            set({ botLoading: false });
          });
      } else {
        set({
          botController: createComputerPlayer(botDifficulty, Math.random, {
            personality: botPersonality,
          }),
        });
      }
    },

    playAgain: () => {
      const state = get();
      if (state.gameMode === GameMode.VS_COMPUTER) {
        state.startVsComputer(state.setupMode);
      } else {
        state.reset(state.setupMode);
      }
    },

    getBotPlayer: () => {
      const state = get();
      if (state.gameMode !== GameMode.VS_COMPUTER || state.localPlayer === null) return null;
      return state.localPlayer === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
    },

    buildBotContext: (rng: Rng = Math.random): BotContext | null => {
      const s = get();
      const bot = s.getBotPlayer();
      if (!bot || s.currentPlayer !== bot || s.isViewingHistory) return null;
      if (
        s.gamePhase !== GamePhase.SETUP &&
        s.gamePhase !== GamePhase.BENCH_SELECTION &&
        s.gamePhase !== GamePhase.PLAYING
      ) {
        return null;
      }
      // En SETUP HIDDEN el bot solo ve sus propias piezas.
      const observable =
        s.gamePhase === GamePhase.SETUP && s.setupMode === SetupTurnMode.HIDDEN
          ? boardWithOnlyOwner(s.board, bot)
          : s.board;
      return {
        board: observable,
        bot,
        botState: s.getCurrentPlayerState(),
        opponentState: s.getOpponentPlayerState(),
        engine: s.movementEngine,
        rules: CURRENT_RULES,
        setupMode: s.setupMode,
        rng,
      };
    },

    applyBotAction: (action: BotPlayAction): boolean => {
      const s = get();
      const bot = s.getBotPlayer();
      if (!bot || s.currentPlayer !== bot || s.gamePhase !== GamePhase.PLAYING) {
        return false;
      }
      const before = JSON.stringify(s.toSnapshot());
      botActing = true;
      try {
        const st = get();
        const ps = st.getCurrentPlayerState();
        if (action.kind === "bench") {
          const piece = ps.getBenchPieces().find((p) => p.id === action.benchPieceId);
          if (piece) {
            st.selectBenchPiece(piece);
            get().placeBenchPiece(action.to);
          }
        } else if (action.kind === "move") {
          const piece = st.board.getPieceById(action.pieceId);
          if (piece?.position) {
            st.selectTile(piece.position);
            get().movePiece(action.to);
          }
        } else {
          get().resolveStalledTurn();
        }
      } finally {
        botActing = false;
      }
      return JSON.stringify(get().toSnapshot()) !== before;
    },

    getBotTurnToken: (): string => {
      const s = get();
      return [
        s.gamePhase,
        s.currentPlayer,
        s.moveHistory.getTotalMoves(),
        s.player1State.getBenchPieces().length,
        s.player2State.getBenchPieces().length,
        s.isViewingHistory,
        s.roomId ?? "",
        s.botControllerId,
      ].join("|");
    },

    runBotTurn: (rng: Rng = Math.random): boolean => {
      const ctx = get().buildBotContext(rng);
      if (!ctx) return false;
      const controller = ensureController(rng);
      if (!controller) return false; // bot lazy aún cargando
      const before = JSON.stringify(get().toSnapshot());

      botActing = true;
      try {
        const st = get();
        const ps = st.getCurrentPlayerState();
        if (
          st.gamePhase === GamePhase.SETUP &&
          ps.getPlacedPiecesCount() < CURRENT_RULES.piecesToPlace
        ) {
          const next = controller.chooseSetupPlacement(ctx);
          if (next) {
            st.selectPieceTypeForSetup(next.type);
            get().placePieceInSetup(next.position);
          }
        } else if (st.gamePhase === GamePhase.SETUP || st.gamePhase === GamePhase.BENCH_SELECTION) {
          const type = controller.chooseBenchType(ctx);
          if (type) st.selectPieceTypeForBench(type);
        } else {
          get().applyBotAction(controller.choosePlayAction(ctx));
        }
      } finally {
        botActing = false;
      }
      return JSON.stringify(get().toSnapshot()) !== before;
    },

    runBotTurnAsync: async (signal: AbortSignal, rng: Rng = Math.random): Promise<boolean> => {
      const ctx = get().buildBotContext(rng);
      if (!ctx) return false;
      const controller = ensureController(rng);
      if (!controller) return false;
      const st = get();
      const inSetupPhase =
        st.gamePhase === GamePhase.SETUP || st.gamePhase === GamePhase.BENCH_SELECTION;

      if (inSetupPhase) {
        if (!controller.prepareSetupAsync) return get().runBotTurn(rng);
        const token = get().getBotTurnToken();
        set({ botThinking: true });
        try {
          await controller.prepareSetupAsync(ctx, signal);
        } catch (err) {
          if ((err as Error).name !== "AbortError" && import.meta.env.DEV) {
            console.error("runBotTurnAsync: prepareSetupAsync falló", err);
          }
          return false;
        } finally {
          set({ botThinking: false });
        }
        if (signal.aborted || get().getBotTurnToken() !== token) return false;
        return get().runBotTurn(rng);
      }

      if (!controller.choosePlayActionAsync) return get().runBotTurn(rng);
      const token = get().getBotTurnToken();
      set({ botThinking: true });
      let actions: BotPlayAction[];
      try {
        actions = await controller.choosePlayActionAsync(ctx, signal);
      } catch (err) {
        if ((err as Error).name !== "AbortError" && import.meta.env.DEV) {
          console.error("runBotTurnAsync: choosePlayActionAsync falló", err);
        }
        return false;
      } finally {
        set({ botThinking: false });
      }
      // La partida siguió sin el bot (historial, reset, jugada remota): descartar.
      if (signal.aborted || get().getBotTurnToken() !== token) return false;

      let changed = false;
      let stalled = actions.length === 0;
      for (const action of actions) {
        if (!get().applyBotAction(action)) {
          stalled = true;
          break;
        }
        changed = true;
      }
      if (stalled) {
        get().resolveStalledTurn();
        return true;
      }
      return changed;
    },

    setSetupMode: (mode: SetupTurnMode) => {
      set((state) => {
        if (state.gamePhase !== GamePhase.SETUP) return state;
        if (
          state.player1State.getPlacedPiecesCount() > 0 ||
          state.player2State.getPlacedPiecesCount() > 0
        ) {
          return state;
        }
        return {
          setupMode: mode,
          setupCompleted: { player1: false, player2: false },
          setupPlayer: Player.BLANCAS,
        };
      });
    },

    setOnlineContext: (roomId: string | null, localPlayer: Player | null) => {
      set({
        roomId,
        localPlayer,
        gameMode: roomId ? GameMode.ONLINE : GameMode.PVP,
      });
    },

    applyRemoteSnapshot: (snapshot: GameSnapshot) => {
      const restored = deserializeGameSnapshot(snapshot);
      set({
        board: restored.board,
        player1State: restored.player1State,
        player2State: restored.player2State,
        currentPlayer: restored.currentPlayer,
        gamePhase: restored.gamePhase,
        pieceIdCounter: restored.pieceIdCounter,
        moveHistory: restored.moveHistory,
        setupMode: restored.setupMode,
        setupCompleted: restored.setupCompleted,
        setupPlayer: restored.currentPlayer,
        selectedPiece: null,
        selectedPieceTypeForPlacement: null,
        selectedBenchPiece: null,
        validMoves: [],
        blockedMoves: [],
        isViewingHistory: false,
        lastPassedPlayer: restored.lastPassedPlayer,
      });
    },

    toSnapshot: () => {
      const state = get();
      return serializeGameSnapshot({
        board: state.board,
        player1State: state.player1State,
        player2State: state.player2State,
        currentPlayer: state.currentPlayer,
        gamePhase: state.gamePhase,
        pieceIdCounter: state.pieceIdCounter,
        moveHistory: state.moveHistory,
        setupMode: state.setupMode,
        setupCompleted: state.setupCompleted,
        lastPassedPlayer: state.lastPassedPlayer,
      });
    },

    getCurrentPlayerState: () => {
      const state = get();
      return state.currentPlayer === Player.BLANCAS ? state.player1State : state.player2State;
    },

    getOpponentPlayerState: () => {
      const state = get();
      return state.currentPlayer === Player.BLANCAS ? state.player2State : state.player1State;
    },

    canSelectPieceType: (type: PieceType) => {
      const state = get();
      if (!state.isLocalPlayerTurn()) return false;
      if (state.gamePhase !== GamePhase.SETUP) return false;
      if (state.selectedPieceTypeForPlacement !== null) return false;

      const playerState = state.getCurrentPlayerState();

      // La elección debe dejar un ejército posible: máximos por tipo y
      // mínimos alcanzables con los slots que quedan (tablero + banca).
      const chosen = playerState
        .getSelectedPieces()
        .concat(playerState.getBenchPieces().map((p) => p.type));
      const remaining = CURRENT_RULES.piecesToPlace + CURRENT_RULES.benchSize - chosen.length;
      if (
        !feasibleTypes(countsOf(chosen, CURRENT_RULES), remaining, CURRENT_RULES).includes(type)
      ) {
        return false;
      }

      // HIDDEN: al completar las 5 piezas se pasa a banca; no se puede elegir
      // más tipos para colocar.
      if (
        state.setupMode === SetupTurnMode.HIDDEN &&
        playerState.getPlacedPiecesCount() >= GAME_RULES.PIECES_TO_PLACE
      ) {
        return false;
      }

      return true;
    },

    canSelectBenchPieceType: (type: PieceType) => {
      const state = get();
      if (!state.isLocalPlayerTurn()) return false;

      const validPhase =
        state.gamePhase === GamePhase.BENCH_SELECTION ||
        (state.gamePhase === GamePhase.SETUP && state.setupMode === SetupTurnMode.HIDDEN);
      if (!validPhase) return false;

      const playerState = state.getCurrentPlayerState();

      // HIDDEN: la banca se elige dentro de SETUP, solo tras colocar las 5 piezas.
      if (state.setupMode === SetupTurnMode.HIDDEN && state.gamePhase === GamePhase.SETUP) {
        if (playerState.getPlacedPiecesCount() < GAME_RULES.PIECES_TO_PLACE) return false;
      }
      const benchCount = playerState.getBenchPieces().length;

      if (benchCount >= GAME_RULES.PIECES_IN_BENCH) {
        return false;
      }

      // La elección debe dejar un ejército posible considerando la SUMA de
      // faltantes para los mínimos, no cada tipo por separado.
      const chosen = playerState
        .getSelectedPieces()
        .concat(playerState.getBenchPieces().map((p) => p.type));
      const remaining = CURRENT_RULES.piecesToPlace + CURRENT_RULES.benchSize - chosen.length;
      return feasibleTypes(countsOf(chosen, CURRENT_RULES), remaining, CURRENT_RULES).includes(
        type,
      );
    },

    canPlaceBenchPiece: () => {
      const state = get();
      if (!state.isLocalPlayerTurn()) return false;
      if (state.gamePhase !== GamePhase.PLAYING) return false;

      return canPlaceFromBench(state.board, state.currentPlayer, state.getCurrentPlayerState());
    },

    selectPieceTypeForSetup: (type: PieceType) => {
      set((state) => {
        if (!state.canSelectPieceType(type)) return state;

        const validPositions = getBenchPlacementSquares(state.board, state.currentPlayer);

        // Clear previous highlights and show new valid positions
        state.board.clearSelection();
        state.board.clearHighlights();
        state.board.highlightPositions(validPositions);

        return {
          selectedPieceTypeForPlacement: type,
          validMoves: validPositions,
          blockedMoves: [],
        };
      });
    },

    selectPieceTypeForBench: (type: PieceType) => {
      set((state) => {
        if (!state.canSelectBenchPieceType(type)) {
          return state;
        }

        const playerState = state.getCurrentPlayerState();
        const pieceId = `bench-${state.currentPlayer}-${state.pieceIdCounter}`;
        const benchPiece = new GamePiece(pieceId, type, null, state.currentPlayer);

        playerState.addBenchPiece(benchPiece);

        const benchCount = playerState.getBenchPieces().length;

        const newState: Partial<GameStateStore> = {
          pieceIdCounter: state.pieceIdCounter + 1,
        };

        if (benchCount >= GAME_RULES.PIECES_IN_BENCH) {
          if (state.setupMode === SetupTurnMode.HIDDEN) {
            // Fin del setup oculto del jugador actual.
            const playerKey = state.currentPlayer === Player.BLANCAS ? "player1" : "player2";
            const updatedCompleted = { ...state.setupCompleted, [playerKey]: true };

            if (updatedCompleted.player1 && updatedCompleted.player2) {
              newState.setupCompleted = updatedCompleted;
              newState.gamePhase = GamePhase.PLAYING;
              newState.currentPlayer = Player.BLANCAS;
            } else {
              const nextPlayer =
                state.currentPlayer === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
              newState.setupCompleted = updatedCompleted;
              newState.currentPlayer = nextPlayer;
              newState.setupPlayer = nextPlayer;
            }
          } else if (state.currentPlayer === Player.BLANCAS) {
            newState.currentPlayer = Player.NEGRAS;
          } else {
            newState.gamePhase = GamePhase.PLAYING;
            newState.currentPlayer = Player.BLANCAS;
          }
        }

        return newState;
      });
      // Si este pick cerró el setup y arrancó PLAYING, puede tocar un turno sin salida.
      get().resolveStalledTurn();
    },

    placePieceInSetup: (position: Position) => {
      set((state) => {
        if (!state.isLocalPlayerTurn()) return state;
        if (state.gamePhase !== GamePhase.SETUP) return state;
        if (!state.selectedPieceTypeForPlacement) return state;

        const playerState = state.getCurrentPlayerState();
        const placedCount = playerState.getPlacedPiecesCount();

        if (placedCount >= GAME_RULES.PIECES_TO_PLACE) return state;

        const isPlacementSquare = getBenchPlacementSquares(state.board, state.currentPlayer).some(
          (p) => p.equals(position),
        );
        if (!isPlacementSquare) return state;

        const pieceType = state.selectedPieceTypeForPlacement;
        const pieceId = `piece-${state.pieceIdCounter}`;
        const piece = new GamePiece(pieceId, pieceType, position, state.currentPlayer);

        state.board.addPiece(piece);
        playerState.addSelectedPiece(pieceType);
        playerState.addPlacedPiece(piece);

        // Clear highlights after placing piece
        state.board.clearSelection();
        state.board.clearHighlights();

        const p1Placed = state.player1State.getPlacedPiecesCount();
        const p2Placed = state.player2State.getPlacedPiecesCount();
        const totalPlaced = p1Placed + p2Placed;

        const newState: Partial<GameStateStore> = {
          pieceIdCounter: state.pieceIdCounter + 1,
          selectedPieceTypeForPlacement: null,
          validMoves: [],
          blockedMoves: [],
        };

        if (state.setupMode === SetupTurnMode.HIDDEN) {
          // HIDDEN: el mismo jugador sigue hasta completar su setup (5 piezas +
          // 3 banca); el cambio de jugador ocurre al terminar la banca.
          state.board.clearSelection();
          state.board.clearHighlights();
        } else if (totalPlaced >= GAME_RULES.PIECES_TO_PLACE * 2) {
          newState.gamePhase = GamePhase.BENCH_SELECTION;
          newState.currentPlayer = Player.BLANCAS;
          // Clear highlights when moving to bench selection
          state.board.clearSelection();
          state.board.clearHighlights();
        } else {
          newState.currentPlayer =
            state.currentPlayer === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
          // Clear highlights when switching turns
          state.board.clearSelection();
          state.board.clearHighlights();
        }

        return newState;
      });
    },

    placeBenchPiece: (position: Position) => {
      set((state) => {
        if (!state.isLocalPlayerTurn()) return state;
        if (state.gamePhase !== GamePhase.PLAYING) return state;

        const playerState = state.getCurrentPlayerState();

        if (!canPlaceFromBench(state.board, state.currentPlayer, playerState)) return state;

        const isPlacementSquare = getBenchPlacementSquares(state.board, state.currentPlayer).some(
          (p) => p.equals(position),
        );
        if (!isPlacementSquare) return state;

        const benchPiece = state.selectedBenchPiece || playerState.getBenchPieces()[0];
        if (!benchPiece) return state;
        benchPiece.moveTo(position);

        state.board.addPiece(benchPiece);
        playerState.removeBenchPiece(benchPiece.id);

        // Clear highlights and selection
        state.board.clearSelection();
        state.board.clearHighlights();

        return {
          selectedBenchPiece: null,
          validMoves: [],
          blockedMoves: [],
        };
      });
      // La banca es acción libre: si tras bajar no queda nada legal, pasa el turno.
      get().resolveStalledTurn();
    },

    selectBenchPiece: (benchPiece: GamePiece) => {
      set((state) => {
        if (!state.isLocalPlayerTurn()) return state;
        if (state.gamePhase !== GamePhase.PLAYING) return state;

        const playerState = state.getCurrentPlayerState();
        const benchPieces = playerState.getBenchPieces();

        if (!benchPieces.includes(benchPiece)) return state;

        const validPositions = getBenchPlacementSquares(state.board, state.currentPlayer);

        state.board.clearSelection();
        state.board.clearHighlights();
        state.board.highlightPositions(validPositions);

        return {
          selectedBenchPiece: benchPiece,
          selectedPiece: null,
          validMoves: validPositions,
          blockedMoves: [],
        };
      });
    },

    selectTile: (position: Position) => {
      set((state) => {
        if (!state.isLocalPlayerTurn()) return state;
        if (state.gamePhase === GamePhase.SETUP) {
          state.placePieceInSetup(position);
          return {};
        }

        if (state.gamePhase === GamePhase.BENCH_SELECTION) {
          return state;
        }

        if (state.gamePhase !== GamePhase.PLAYING) return state;

        const clickedPiece = state.board.getPieceAt(position);

        // Handle bench piece placement
        if (state.selectedBenchPiece) {
          state.placeBenchPiece(position);
          return {};
        }

        if (state.selectedPiece) {
          const isValidMove = state.validMoves.some((pos) => pos.equals(position));
          if (isValidMove) {
            return state;
          }

          if (clickedPiece && clickedPiece.owner === state.currentPlayer) {
            state.board.clearSelection();
            state.board.selectTile(position);
            const validMoves = state.movementEngine.getValidMoves(clickedPiece, state.board);
            const blockedMoves = state.movementEngine.getBlockedMoves(clickedPiece, state.board);
            state.board.highlightPositions(validMoves);
            return {
              selectedPiece: clickedPiece,
              validMoves,
              blockedMoves,
            };
          }

          state.board.clearSelection();
          state.board.clearHighlights();
          return {
            selectedPiece: null,
            validMoves: [],
            blockedMoves: [],
          };
        }

        if (clickedPiece && clickedPiece.owner === state.currentPlayer) {
          state.board.selectTile(position);
          const validMoves = state.movementEngine.getValidMoves(clickedPiece, state.board);
          const blockedMoves = state.movementEngine.getBlockedMoves(clickedPiece, state.board);
          state.board.highlightPositions(validMoves);
          return {
            selectedPiece: clickedPiece,
            validMoves,
            blockedMoves,
          };
        }

        return state;
      });
    },

    handleTileClick: (position: Position) => {
      const state = get();
      if (state.isViewingHistory) return;
      if (!state.isLocalPlayerTurn()) return;
      if (state.gamePhase !== GamePhase.SETUP && state.gamePhase !== GamePhase.PLAYING) {
        return;
      }

      const clickedPiece = state.board.getPieceAt(position);

      // 1. Banca (acción libre): solo con pieza de banca seleccionada, o sin pieza de
      //    tablero seleccionada y sobre una casilla de despliegue válida.
      if (state.gamePhase === GamePhase.PLAYING && state.canPlaceBenchPiece() && !clickedPiece) {
        const isPlacementSquare = getBenchPlacementSquares(state.board, state.currentPlayer).some(
          (p) => p.equals(position),
        );
        if (state.selectedBenchPiece || (!state.selectedPiece && isPlacementSquare)) {
          state.placeBenchPiece(position);
          return;
        }
      }

      // 2. Confirmed move
      if (state.selectedPiece && state.validMoves.some((p) => p.equals(position))) {
        state.movePiece(position);
        return;
      }

      // 3. Selection / reselection / deselection / SETUP placement
      state.selectTile(position);
    },

    checkScoring: (piece: GamePiece) => {
      const state = get();
      const scoringRow =
        state.currentPlayer === Player.BLANCAS
          ? GAME_RULES.SCORING_ZONE_PLAYER1
          : GAME_RULES.SCORING_ZONE_PLAYER2;

      if (piece.position && piece.position.y === scoringRow) {
        const playerState =
          piece.owner === Player.BLANCAS ? state.player1State : state.player2State;
        playerState.incrementScore();
        state.board.removePiece(piece.id);

        set({});
        get().checkGameOver();
      }
    },

    checkGameOver: () => {
      const state = get();
      const p1Score = state.player1State.getScore();
      const p2Score = state.player2State.getScore();

      if (p1Score >= GAME_RULES.POINTS_TO_WIN || p2Score >= GAME_RULES.POINTS_TO_WIN) {
        set({ gamePhase: GamePhase.GAME_OVER });
        return;
      }

      const p1HasMoves = hasAnyLegalMove(state.board, Player.BLANCAS, state.movementEngine);
      const p2HasMoves = hasAnyLegalMove(state.board, Player.NEGRAS, state.movementEngine);

      if (!p1HasMoves && !p2HasMoves) {
        set({ gamePhase: GamePhase.GAME_OVER });
      }
    },

    movePiece: (to: Position) => {
      set((state) => {
        if (!state.isLocalPlayerTurn()) return state;
        if (state.gamePhase !== GamePhase.PLAYING) return state;
        if (!state.selectedPiece) return state;

        const isValidMove = state.validMoves.some((pos) => pos.equals(to));
        if (!isValidMove) return state;

        const fromPosition = new Position(
          state.selectedPiece.position!.x,
          state.selectedPiece.position!.y,
        );
        const capturedPiece = state.board.getPieceAt(to);

        // Execute the move first
        state.board.movePiece(state.selectedPiece.id, to);
        state.selectedPiece.moveTo(to);

        // Then save the snapshot AFTER the move
        const moveRecord: MoveRecord = {
          moveNumber: state.moveHistory.getTotalMoves() + 1,
          player: state.currentPlayer,
          pieceId: state.selectedPiece.id,
          pieceType: state.selectedPiece.type,
          from: fromPosition,
          to: new Position(to.x, to.y),
          captured: capturedPiece
            ? {
                pieceId: capturedPiece.id,
                pieceType: capturedPiece.type,
                position: new Position(to.x, to.y),
              }
            : undefined,
          boardSnapshot: JSON.stringify(
            state.board.getAllPieces().map((p) => ({
              id: p.id,
              type: p.type,
              owner: p.owner,
              position: p.position ? { x: p.position.x, y: p.position.y } : null,
            })),
          ),
          timestamp: new Date(),
        };

        state.moveHistory.addMove(moveRecord);

        state.checkScoring(state.selectedPiece);

        state.board.clearSelection();
        state.board.clearHighlights();

        const nextPlayer = state.currentPlayer === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;

        return {
          selectedPiece: null,
          validMoves: [],
          currentPlayer: nextPlayer,
          isViewingHistory: false,
          lastPassedPlayer: null,
        };
      });
      // El jugador que recibe el turno puede no tener acciones: pasa o termina.
      get().resolveStalledTurn();
    },

    resolveStalledTurn: () => {
      const state = get();
      if (state.gamePhase !== GamePhase.PLAYING) return;
      const stateOf = (p: Player) =>
        p === Player.BLANCAS ? state.player1State : state.player2State;
      const current = state.currentPlayer;
      const other = current === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
      if (hasAnyLegalAction(state.board, current, stateOf(current), state.movementEngine)) return;
      if (hasAnyLegalAction(state.board, other, stateOf(other), state.movementEngine)) {
        set({ currentPlayer: other, lastPassedPlayer: current });
        return;
      }
      set({ gamePhase: GamePhase.GAME_OVER });
    },

    startGame: () => {
      set({ gamePhase: GamePhase.SETUP, currentPlayer: Player.BLANCAS });
    },

    hoverTile: (position: Position | null) => {
      set((state) => {
        if (!position) return state;
        return state;
      });
    },

    reset: (setupMode: SetupTurnMode = SetupTurnMode.ALTERNATING) => {
      get().botController?.dispose?.();
      const board = createInitialBoard();
      const player1State = new PlayerState("player1");
      const player2State = new PlayerState("player2");

      set({
        board,
        gamePhase: GamePhase.SETUP,
        gameMode: GameMode.PVP,
        currentPlayer: Player.BLANCAS,
        player1State,
        player2State,
        selectedPiece: null,
        selectedPieceTypeForPlacement: null,
        selectedBenchPiece: null,
        validMoves: [],
        blockedMoves: [],
        pieceIdCounter: 0,
        moveHistory: new MoveHistory(),
        isViewingHistory: false,
        localPlayer: null,
        roomId: null,
        setupMode,
        setupCompleted: { player1: false, player2: false },
        setupPlayer: Player.BLANCAS,
        lastPassedPlayer: null,
        botController: null,
        botThinking: false,
        botLoading: false,
      });
    },

    quickStart: (player1LayoutId, player2LayoutId) => {
      if (get().gameMode === GameMode.ONLINE) return;
      const quick = buildQuickStartState({
        player1: player1LayoutId,
        player2: player2LayoutId,
      });

      set({
        board: quick.board,
        gamePhase: GamePhase.PLAYING,
        currentPlayer: Player.BLANCAS,
        player1State: quick.player1State,
        player2State: quick.player2State,
        selectedPiece: null,
        selectedPieceTypeForPlacement: null,
        selectedBenchPiece: null,
        validMoves: [],
        blockedMoves: [],
        pieceIdCounter: quick.pieceIdCounter,
        moveHistory: new MoveHistory(),
        isViewingHistory: false,
        setupMode: SetupTurnMode.ALTERNATING,
        setupCompleted: { player1: false, player2: false },
        setupPlayer: Player.BLANCAS,
        lastPassedPlayer: null,
      });
      get().resolveStalledTurn();
    },

    prepareOnlineGame: (
      setupMode: RoomSetupMode,
      setupTurnMode: SetupTurnMode = SetupTurnMode.ALTERNATING,
      quickStartLayouts?: QuickStartLayoutSelection,
    ) => {
      const initial =
        setupMode === "quick" ? buildQuickStartState(quickStartLayouts) : buildManualStartState();

      set({
        board: initial.board,
        gamePhase: setupMode === "quick" ? GamePhase.PLAYING : GamePhase.SETUP,
        gameMode: GameMode.PVP,
        currentPlayer: Player.BLANCAS,
        player1State: initial.player1State,
        player2State: initial.player2State,
        selectedPiece: null,
        selectedPieceTypeForPlacement: null,
        selectedBenchPiece: null,
        validMoves: [],
        blockedMoves: [],
        pieceIdCounter: initial.pieceIdCounter,
        moveHistory: new MoveHistory(),
        isViewingHistory: false,
        localPlayer: null,
        roomId: null,
        setupMode: setupTurnMode,
        setupCompleted: { player1: false, player2: false },
        setupPlayer: Player.BLANCAS,
        lastPassedPlayer: null,
      });
      get().resolveStalledTurn();
    },

    setGameMode: (mode: GameMode) => {
      set({ gameMode: mode });
    },

    goBackInHistory: () => {
      const state = get();
      if (!state.moveHistory.canGoBack()) return;

      const previousMove = state.moveHistory.goBack();
      if (!previousMove) return;

      const newBoard = restoreBoardFromSnapshot(previousMove.boardSnapshot);

      set({
        board: newBoard,
        isViewingHistory: true,
        selectedPiece: null,
        validMoves: [],
        blockedMoves: [],
      });
    },

    goForwardInHistory: () => {
      const state = get();
      if (!state.moveHistory.canGoForward()) return;

      const nextMove = state.moveHistory.goForward();
      if (!nextMove) return;

      const newBoard = restoreBoardFromSnapshot(nextMove.boardSnapshot);

      const isAtPresent = !state.moveHistory.isViewingHistory();

      set({
        board: newBoard,
        isViewingHistory: !isAtPresent,
        selectedPiece: null,
        validMoves: [],
        blockedMoves: [],
      });
    },

    returnToPresent: () => {
      const state = get();

      while (state.moveHistory.canGoForward()) {
        state.moveHistory.goForward();
      }

      const currentMove = state.moveHistory.getCurrentMove();
      if (!currentMove) return;

      const newBoard = restoreBoardFromSnapshot(currentMove.boardSnapshot);

      set({
        board: newBoard,
        isViewingHistory: false,
        selectedPiece: null,
        validMoves: [],
        blockedMoves: [],
      });
    },

    getMoveHistory: () => {
      return get().moveHistory.getAllMoves();
    },

    canGoBack: () => {
      return get().moveHistory.canGoBack();
    },

    canGoForward: () => {
      return get().moveHistory.canGoForward();
    },
  };
};

/**
 * Fábrica de stores de juego independientes. `useGameStore` es el singleton
 * de la app; los tests de flujo online crean instancias aisladas para simular
 * dos clientes reales en el mismo proceso.
 */
export const createGameStore = () => create<GameStateStore>(gameStoreInitializer);

export const useGameStore = createGameStore();

export class GameState implements IGameState {
  getBoard(): Board {
    return useGameStore.getState().board;
  }

  selectTile(position: Position): void {
    useGameStore.getState().selectTile(position);
  }

  hoverTile(position: Position | null): void {
    useGameStore.getState().hoverTile(position);
  }

  reset(): void {
    useGameStore.getState().reset();
  }

  subscribe(callback: () => void): () => void {
    return useGameStore.subscribe(callback);
  }
}
