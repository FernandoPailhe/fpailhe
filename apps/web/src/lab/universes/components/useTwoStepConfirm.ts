import { useCallback, useState } from "react";

/**
 * Confirmación en dos pasos: el primer clic "arma" el botón (el caller cambia
 * el texto), el segundo confirma. `Escape` o perder el foco desarma.
 */
export function useTwoStepConfirm(onConfirm: () => void) {
  const [armed, setArmed] = useState(false);

  const confirm = useCallback(() => {
    if (armed) {
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
    }
  }, [armed, onConfirm]);

  const cancel = useCallback(() => setArmed(false), []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    },
    [cancel],
  );

  return { armed, confirm, cancel, onKeyDown, onBlur: cancel };
}
