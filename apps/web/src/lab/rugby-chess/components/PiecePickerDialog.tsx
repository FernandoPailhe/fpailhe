import { Dialog } from "@ferpa/ui";
import { useGameStore } from "../application/GameState";
import { GamePhase } from "../domain/constants/GameRules";
import { PieceTypePicker } from "./PieceTypePicker";

/**
 * Modal bloqueante con el selector de pieza + indicación. Se abre cuando el
 * juego requiere elegir pieza: en SETUP mientras no hay tipo seleccionado, y
 * durante todo BENCH_SELECTION. No se cierra con Escape ni click afuera —
 * el usuario debe elegir antes de seguir (issue #2).
 */
export function PiecePickerDialog() {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const selectedType = useGameStore((s) => s.selectedPieceTypeForPlacement);

  const open =
    (gamePhase === GamePhase.SETUP && selectedType === null) ||
    gamePhase === GamePhase.BENCH_SELECTION;

  return (
    <Dialog open={open} onClose={() => {}} blocking labelledBy="piece-picker-title">
      <div className="border border-line bg-surface px-6 py-5">
        <h2 id="piece-picker-title" className="font-display text-xl font-bold text-ink">
          Choose your piece
        </h2>
        <PieceTypePicker />
      </div>
    </Dialog>
  );
}
