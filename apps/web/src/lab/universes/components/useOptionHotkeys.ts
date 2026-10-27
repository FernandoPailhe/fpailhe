import { useEffect } from "react";

import type { OptionView } from "../application/types";
import type { ID } from "../domain/models";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Teclas `1`–`3`: eligen la opción disponible con ese numeral (el que se
 * muestra en pantalla). Ignora campos de texto y modificadores.
 * `enabled` solo debería ser true en fase `card`.
 */
export function useOptionHotkeys(
  options: OptionView[],
  onChoose: (id: ID) => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const n = Number.parseInt(event.key, 10);
      if (!Number.isInteger(n) || n < 1 || n > options.length) return;
      const option = options[n - 1];
      if (option !== undefined && option.state === "available") onChoose(option.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, onChoose, enabled]);
}
