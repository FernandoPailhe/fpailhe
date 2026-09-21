import { Button } from "@ferpa/ui";
import { Player } from "../domain/constants/PieceConstants";
import { PLAYER_LABEL } from "../lib/gameDisplay";

export interface SetupPassScreenProps {
  /** Jugador que debe configurar a continuación. */
  waitingFor: Player;
  /** true = partida local (se pasa el dispositivo); false = online (se espera al rival). */
  localMode: boolean;
  onContinue: () => void;
}

/**
 * Pantalla bloqueante del setup oculto. En local pide pasar el dispositivo
 * al siguiente jugador; en online muestra una espera mientras el rival
 * termina su configuración.
 */
export function SetupPassScreen({ waitingFor, localMode, onContinue }: SetupPassScreenProps) {
  return (
    <section
      aria-label="Hidden setup"
      className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4 border border-line bg-surface px-6 py-10 text-center"
    >
      <p className="font-ui text-sm text-ink" role="status">
        {localMode
          ? `Pass the device to ${PLAYER_LABEL[waitingFor]}`
          : `Waiting for ${PLAYER_LABEL[waitingFor]} to finish setup…`}
      </p>
      {localMode && (
        <Button type="button" onClick={onContinue} autoFocus>
          I’m ready
        </Button>
      )}
    </section>
  );
}
