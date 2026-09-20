import { useGameStore } from "../application/GameState";
import { PieceType } from "../domain/constants/PieceConstants";
import { GamePhase, GAME_RULES } from "../domain/constants/GameRules";
import { PIECE_LABEL, PLAYER_LABEL } from "../lib/gameDisplay";
import { PieceToken } from "./PieceToken";

const PIECE_TYPES = [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER];

/**
 * Selector de tipo de pieza para SETUP y BENCH_SELECTION.
 * Lee la fase del store y usa el par de acciones correspondiente.
 */
export function PieceTypePicker() {
  const {
    gamePhase,
    currentPlayer,
    selectedPieceTypeForPlacement,
    canSelectPieceType,
    canSelectBenchPieceType,
    selectPieceTypeForSetup,
    selectPieceTypeForBench,
    getCurrentPlayerState,
  } = useGameStore();

  const isSetup = gamePhase === GamePhase.SETUP;
  const playerState = getCurrentPlayerState();
  const benchPieces = playerState.getBenchPieces();

  return (
    <section
      aria-label={isSetup ? "Choose a piece type to place" : "Choose bench pieces"}
      className="mx-auto w-full max-w-[420px]"
    >
      <p className="font-ui text-sm text-ink-dim">
        {isSetup
          ? `${PLAYER_LABEL[currentPlayer]}: pick a piece type, then click a highlighted square`
          : `${PLAYER_LABEL[currentPlayer]}: choose ${GAME_RULES.PIECES_IN_BENCH} bench pieces (${benchPieces.length}/${GAME_RULES.PIECES_IN_BENCH})`}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {PIECE_TYPES.map((type) => {
          const canSelect = isSetup ? canSelectPieceType(type) : canSelectBenchPieceType(type);
          const isActive = isSetup && selectedPieceTypeForPlacement === type;
          const totalOfType =
            playerState.getSelectedPieceCount(type) +
            benchPieces.filter((p) => p.type === type).length;
          return (
            <button
              key={type}
              type="button"
              disabled={!canSelect}
              aria-pressed={isActive}
              onClick={() =>
                isSetup ? selectPieceTypeForSetup(type) : selectPieceTypeForBench(type)
              }
              className={`flex flex-col items-center gap-2 border border-line bg-surface px-3 py-4 font-ui text-sm text-ink transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                isActive ? "ring-2 ring-inset ring-gold-bright" : ""
              }`}
            >
              <span className="h-10 w-10">
                <PieceToken type={type} owner={currentPlayer} />
              </span>
              <span>{PIECE_LABEL[type]}</span>
              <span className="text-xs text-ink-dim">
                {totalOfType}/{GAME_RULES.MAX_PIECES_PER_TYPE}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
