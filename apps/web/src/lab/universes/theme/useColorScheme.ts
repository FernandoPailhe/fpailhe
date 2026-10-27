/**
 * Preferencia de esquema del sistema. `undefined` en SSR o cuando no hay
 * `matchMedia`; escucha cambios y limpia el listener al desmontar.
 */
import { useEffect, useState } from "react";

export function usePrefersDark(): boolean | undefined {
  const [dark, setDark] = useState<boolean | undefined>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void => setDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return dark;
}
