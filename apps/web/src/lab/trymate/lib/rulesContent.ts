import { PieceType, Player } from "../domain/constants/PieceConstants";
import { CURRENT_RULES, type RulesView } from "../domain/config/RulesView";

export type RulesLanguage = "en" | "es";

export const RULES_LANGUAGES: { id: RulesLanguage; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

export interface PieceRule {
  type: PieceType;
  /** Una línea, para captions en el selector de piezas. */
  short: string;
  move: string;
  capture: string;
  special: string;
}

export interface RulesSection {
  title: string;
  body: string;
}

export interface RulesContent {
  title: string;
  objective: string;
  board: string;
  flow: RulesSection[];
  pieces: PieceRule[];
  online: string;
  computer: string;
  labels: { move: string; capture: string; special: string };
  diagramLegend: { move: string; capture: string; block: string };
}

/** "2–4" si son consecutivas; si no, "2, 4, 6". Filas visibles (base 1). */
const fmtRows = (rows: readonly number[]): string => {
  const sorted = [...rows].sort((a, b) => a - b);
  const consecutive = sorted.every((r, i) => i === 0 || r === sorted[i - 1]! + 1);
  if (consecutive && sorted.length > 1) {
    return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  }
  return sorted.join(", ");
};

/** Filas de despliegue del jugador ya en numeración visible (base 1). */
const visibleRows = (rules: RulesView, p: Player): string =>
  fmtRows(rules.placementRows(p).map((y) => y + 1));

/**
 * Textos del panel de reglas con los números sacados de `rules`: tablero,
 * filas de despliegue/anotación, cantidades y límites. Cambiar GAME_CONFIG /
 * GAME_RULES actualiza estos textos sin tocarlos a mano.
 */
export function buildRulesContent(
  rules: RulesView = CURRENT_RULES,
): Record<RulesLanguage, RulesContent> {
  const w = rules.width;
  const h = rules.height;
  const placeW = visibleRows(rules, Player.BLANCAS);
  const placeB = visibleRows(rules, Player.NEGRAS);
  const scoreW = rules.scoringRow(Player.BLANCAS) + 1;
  const scoreB = rules.scoringRow(Player.NEGRAS) + 1;
  const homeW = rules.homeRow(Player.BLANCAS) + 1;
  const homeB = rules.homeRow(Player.NEGRAS) + 1;

  return {
    en: {
      title: "How to play",
      objective: `TryMate is a tactical race on a ${w}×${h} field. Push your pieces to the far end of the board to score — first player to ${rules.pointsToWin} points wins. The game also ends if neither side has a legal move.`,
      board: `The field is ${w} columns × ${h} rows. You deploy on rows ${placeW} (White) or ${placeB} (Black) and score by reaching the opponent's last row (row ${scoreW} for White, row ${scoreB} for Black). Rows ${homeW} and ${homeB} are never deployment rows.`,
      flow: [
        {
          title: "Setup",
          body: `Players alternate placing ${rules.piecesToPlace} pieces on their home rows — at most ${rules.maxPerRow} pieces per row and at most ${rules.maxPerType} of the same type.`,
        },
        {
          title: "Bench",
          body: `Each player then picks ${rules.benchSize} reserve pieces. Between board and bench you must field at least ${rules.minPerType} of every type.`,
        },
        {
          title: "Playing",
          body: "On your turn, select one of your pieces and move it to a highlighted square — or place a bench piece on your home rows as a free action that keeps your turn.",
        },
        {
          title: "Scoring",
          body: `A piece that reaches the opponent's last row scores 1 point and leaves the field. First to ${rules.pointsToWin} points wins.`,
        },
      ],
      // Si cambia PIECE_MOVEMENT_CONFIG, actualizar estas descripciones
      // (ver receta en .devin/skills/rugby-chess-domain).
      pieces: [
        {
          type: PieceType.FORT,
          short: "1 forward · blocks sides",
          move: "Moves exactly 1 square forward.",
          capture: "Captures diagonally forward, left or right — never straight ahead.",
          special:
            "A Fort blocks the two squares beside it: enemy pieces cannot enter them (except by capturing the Fort itself).",
        },
        {
          type: PieceType.STRIKER,
          short: "1 forward or diagonal · 2-step charge",
          move: "Moves 1 square forward or diagonally forward, and can charge 2 squares straight ahead if the path is clear.",
          capture: "Captures only straight ahead.",
          special: "Its 2-step charge makes it the fastest piece off the line.",
        },
        {
          type: PieceType.PIONEER,
          short: "1–3 forward + 1 sideways (L-shape)",
          move: "Moves 1 to 3 squares forward, then optionally 1 square sideways — an L-shape of at most 3 squares total.",
          capture: "Cannot capture.",
          special:
            "A Pioneer can slip past a Fort's side block when the Fort is at least 2 rows ahead — from 1 row away it is stopped.",
        },
      ],
      online:
        "Online: create a room and share the link, or join an open room. The host always plays White. Check 'Quick start' when creating a room to skip setup and start with armies already placed.",
      computer:
        "Vs computer: you play White. Easy makes quick, imperfect decisions; Medium looks one reply ahead, blocks your runners and advances in formation.",
      labels: { move: "Move", capture: "Capture", special: "Special" },
      diagramLegend: { move: "Move", capture: "Capture", block: "Blocked" },
    },
    es: {
      title: "Cómo jugar",
      objective: `TryMate es una carrera táctica en un campo de ${w}×${h}. Llevá tus piezas hasta la última fila rival para sumar puntos — gana el primero en llegar a ${rules.pointsToWin}. La partida también termina si ningún jugador tiene movimientos legales.`,
      board: `El campo tiene ${w} columnas × ${h} filas. Desplegás en las filas ${placeW} (Blancas) u ${placeB} (Negras) y anotás al llegar a la última fila rival (fila ${scoreW} para Blancas, fila ${scoreB} para Negras). Las filas ${homeW} y ${homeB} nunca son de despliegue.`,
      flow: [
        {
          title: "Despliegue",
          body: `Los jugadores alternan colocando ${rules.piecesToPlace} piezas en sus filas iniciales — máximo ${rules.maxPerRow} piezas por fila y ${rules.maxPerType} del mismo tipo.`,
        },
        {
          title: "Banca",
          body: `Luego cada jugador elige ${rules.benchSize} piezas de reserva. Entre tablero y banca tenés que tener al menos ${rules.minPerType} de cada tipo.`,
        },
        {
          title: "Juego",
          body: "En tu turno, seleccioná una pieza propia y movela a una casilla resaltada — o colocá una pieza de la banca en tus filas como acción gratuita que no consume el turno.",
        },
        {
          title: "Puntuación",
          body: `Una pieza que llega a la última fila rival suma 1 punto y sale del campo. El primero en llegar a ${rules.pointsToWin} gana.`,
        },
      ],
      // Si cambia PIECE_MOVEMENT_CONFIG, actualizar estas descripciones
      // (ver receta en .devin/skills/rugby-chess-domain).
      pieces: [
        {
          type: PieceType.FORT,
          short: "1 al frente · bloquea los costados",
          move: "Se mueve exactamente 1 casilla hacia adelante.",
          capture: "Captura en diagonal hacia adelante, izquierda o derecha — nunca de frente.",
          special:
            "Un Fort bloquea las dos casillas a sus costados: las piezas rivales no pueden entrar (salvo capturando al Fort).",
        },
        {
          type: PieceType.STRIKER,
          short: "1 al frente o diagonal · carga de 2",
          move: "Se mueve 1 casilla hacia adelante o en diagonal hacia adelante, y puede cargar 2 casillas de frente si el camino está libre.",
          capture: "Captura solo de frente.",
          special: "Su doble paso lo convierte en la pieza más rápida en salir de la línea.",
        },
        {
          type: PieceType.PIONEER,
          short: "1–3 al frente + 1 al costado (en L)",
          move: "Se mueve de 1 a 3 casillas hacia adelante y opcionalmente 1 al costado — una L de máximo 3 casillas en total.",
          capture: "No puede capturar.",
          special:
            "Un Pioneer puede pasar el bloqueo lateral de un Fort si este está al menos 2 filas adelante — a 1 fila queda frenado.",
        },
      ],
      online:
        "Online: creá una sala y compartí el link, o sumate a una sala abierta. El host siempre juega Blancas. Marcá 'Quick start' al crear la sala para saltar el despliegue y arrancar con los ejércitos listos.",
      computer:
        "Vs computadora: jugás con Blancas. Fácil decide rápido y con errores; Medio mira tu respuesta, frena tus corredores y avanza en bloque.",
      labels: { move: "Movimiento", capture: "Captura", special: "Especial" },
      diagramLegend: { move: "Movimiento", capture: "Captura", block: "Bloqueada" },
    },
  };
}

export const RULES_CONTENT: Record<RulesLanguage, RulesContent> = buildRulesContent();

export type DiagramCellKind = "move" | "capture" | "block";

export interface MoveDiagramSpec {
  /** Posición de la pieza en el mini-tablero 5×5. */
  piece: { x: number; y: number };
  cells: { x: number; y: number; kind: DiagramCellKind }[];
}

const pos = (x: number, y: number, kind: DiagramCellKind) => ({ x, y, kind });

/** Ejemplos desde la perspectiva de Blancas (arriba = hacia adelante). */
export const MOVE_DIAGRAMS: Record<PieceType, MoveDiagramSpec> = {
  [PieceType.FORT]: {
    piece: { x: 2, y: 1 },
    cells: [
      pos(2, 2, "move"),
      pos(1, 2, "capture"),
      pos(3, 2, "capture"),
      pos(1, 1, "block"),
      pos(3, 1, "block"),
    ],
  },
  [PieceType.STRIKER]: {
    piece: { x: 2, y: 1 },
    cells: [pos(2, 2, "capture"), pos(1, 2, "move"), pos(3, 2, "move"), pos(2, 3, "move")],
  },
  [PieceType.PIONEER]: {
    piece: { x: 2, y: 0 },
    cells: [
      pos(2, 1, "move"),
      pos(1, 1, "move"),
      pos(3, 1, "move"),
      pos(2, 2, "move"),
      pos(1, 2, "move"),
      pos(3, 2, "move"),
      pos(2, 3, "move"),
    ],
  },
};
