import { useEffect, useRef } from "react";

import type { RefObject } from "react";

/** Enfoca el elemento al montarse (o cuando cambia `dep`). Úsese en el `<h1>` de cada pantalla. */
export function useFocusOnMount<T extends HTMLElement>(dep?: unknown): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [dep]);
  return ref;
}
