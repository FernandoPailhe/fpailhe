import type { Board } from "../../domain/entities/Board";
import type { Position } from "../../domain/entities/Position";
import type { PlayerState } from "../../domain/entities/PlayerState";
import type { PieceType, Player } from "../../domain/constants/PieceConstants";
import type { SetupTurnMode } from "../../domain/constants/GameRules";
import type { RulesView } from "../../domain/config/RulesView";
import type { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { createEasyBot } from "./EasyBot";
import { createMediumBot } from "./MediumBot";
import type { Personality } from "./personality";
import type { Rng } from "./rng";

export type BotDifficulty = "easy" | "medium" | "hard";

/** Opciones de creación del bot (Easy/Medium las ignoran). */
export interface BotFactoryOpts {
  personality: Personality;
}

export const DEFAULT_BOT_OPTS: BotFactoryOpts = { personality: "balanced" };

export type BotFactory = (rng: Rng, opts: BotFactoryOpts) => ComputerPlayer;

/** Acción de juego elegida por un bot en PLAYING. */
export type BotPlayAction =
  | { kind: "bench"; benchPieceId: string; to: Position }
  | { kind: "move"; pieceId: string; to: Position }
  | { kind: "pass" };

/**
 * Diagnóstico uniforme de la última decisión de PLAYING de un bot
 * (selfplay/estadísticas): qué evaluó, cuánto buscó y sus mejores
 * alternativas. `eval` es desde el punto de vista del bot que decidió.
 */
export interface DecisionInfo {
  eval?: number;
  depth?: number;
  nodes?: number;
  ms?: number;
  posture?: string;
  personality?: string;
  /** Candidatas ordenadas de mejor a peor (hasta 5). */
  top?: { action: BotPlayAction; score: number }[];
}

/**
 * Todo lo que un bot puede consultar para decidir. En SETUP HIDDEN el board
 * solo muestra las piezas propias. El bot no conoce reglas por su cuenta:
 * las recibe acá (`rules`, `engine`) — nunca importa las constantes del juego.
 */
export interface BotContext {
  board: Board;
  bot: Player;
  botState: PlayerState;
  opponentState: PlayerState;
  engine: MovementRuleEngine;
  rules: RulesView;
  setupMode: SetupTurnMode;
  rng: Rng;
}

/**
 * Jugador controlado por computadora. Su estado interno (plan de despliegue,
 * memoizaciones) vive en la instancia, no en el store.
 */
export interface ComputerPlayer {
  readonly difficulty: BotDifficulty;
  /** Próxima pieza a colocar en SETUP; null si no hay colocación válida. */
  chooseSetupPlacement(ctx: BotContext): { type: PieceType; position: Position } | null;
  /** Próximo tipo de banca; null si no hay elección válida. */
  chooseBenchType(ctx: BotContext): PieceType | null;
  /** Acción de PLAYING: banca, movimiento o pase. */
  choosePlayAction(ctx: BotContext): BotPlayAction;
  /**
   * Variante async de choosePlayAction (bots pesados como Hard): devuelve la
   * secuencia completa del turno — 0..k bajadas de banca seguidas de un
   * movimiento o pase. Cancelable vía `signal`; resultados tardíos se
   * descartan por token de turno.
   */
  choosePlayActionAsync?(ctx: BotContext, signal: AbortSignal): Promise<BotPlayAction[]>;
  /**
   * Cálculo pesado previo a las decisiones de setup/banca (Hard planifica su
   * ejército en el worker). Después, `chooseSetupPlacement`/`chooseBenchType`
   * síncronos consumen lo preparado.
   */
  prepareSetupAsync?(ctx: BotContext, signal: AbortSignal): Promise<void>;
  /** Libera recursos (Hard: termina el worker). Opcional. */
  dispose?(): void;
  /**
   * Diagnóstico de la última decisión de PLAYING; null si el bot aún no jugó.
   * No afecta el determinismo de la jugada (ms es solo informativo).
   */
  getLastDecisionInfo?(): DecisionInfo | null;
}

const FACTORIES: Partial<Record<BotDifficulty, BotFactory>> = {
  easy: createEasyBot,
  medium: createMediumBot,
};

/**
 * Cargas diferidas: el `import()` dinámico mantiene el código de Hard fuera
 * del chunk principal — se descarga recién al elegir la dificultad. Ningún
 * archivo de producción importa `ai/hard/**` estáticamente.
 */
const LOADERS: Partial<Record<BotDifficulty, () => Promise<BotFactory>>> = {
  hard: () => import("./hard/HardBot").then((m) => m.createHardBot),
};

/** True si la dificultad no tiene fábrica sync y necesita `loadComputerPlayer`. */
export function needsAsyncLoad(difficulty: BotDifficulty): boolean {
  return !FACTORIES[difficulty] && !!LOADERS[difficulty];
}

export function registerComputerPlayer(difficulty: BotDifficulty, factory: BotFactory): void {
  FACTORIES[difficulty] = factory;
}

export function createComputerPlayer(
  difficulty: BotDifficulty,
  rng: Rng,
  opts: BotFactoryOpts = DEFAULT_BOT_OPTS,
): ComputerPlayer {
  const factory = FACTORIES[difficulty];
  if (!factory) {
    throw new Error(`ComputerPlayer: dificultad "${difficulty}" requiere loadComputerPlayer`);
  }
  return factory(rng, opts);
}

/** Resuelve la fábrica de una dificultad (sync o vía loader lazy como Hard). */
export async function loadBotFactory(difficulty: BotDifficulty): Promise<BotFactory> {
  const factory = FACTORIES[difficulty] ?? (await LOADERS[difficulty]?.());
  if (!factory) {
    throw new Error(`ComputerPlayer: dificultad no registrada "${difficulty}"`);
  }
  return factory;
}

/** Resuelve el bot: fábrica sync si existe, o el loader lazy (Hard). */
export async function loadComputerPlayer(
  difficulty: BotDifficulty,
  rng: Rng,
  opts: BotFactoryOpts = DEFAULT_BOT_OPTS,
): Promise<ComputerPlayer> {
  return (await loadBotFactory(difficulty))(rng, opts);
}
