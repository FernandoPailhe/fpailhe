import { useLayoutEffect, useState } from "react";
import { GAME_CONFIG } from "../domain/constants/GameConstants";

export interface BoardSize {
  tileSize: number;
  boardWidth: number;
  boardHeight: number;
}

/** Fracción del alto de ventana que el tablero puede ocupar como máximo. */
const BOARD_MAX_VIEWPORT_HEIGHT = 0.9;

/**
 * Fracción del ancho de ventana que el tablero puede ocupar como máximo en
 * ventanas verticales (alto > ancho, como la de un celular).
 */
const BOARD_MAX_PORTRAIT_VIEWPORT_WIDTH = 0.8;

function computeBoardSize(containerWidth: number): BoardSize {
  // La variable dominante es el alto disponible: el tablero (5×11 casillas
  // cuadradas) nunca supera el 90 % del alto de la ventana. El ancho del
  // contenedor actúa como segundo límite en viewports estrechos; en ventanas
  // verticales se acota además al 80 % del ancho de la ventana.
  const maxHeight = window.innerHeight * BOARD_MAX_VIEWPORT_HEIGHT;
  const tileFromHeight = Math.floor(maxHeight / GAME_CONFIG.BOARD_HEIGHT);
  const isPortrait = window.innerHeight > window.innerWidth;
  const widthLimit = isPortrait
    ? Math.min(containerWidth, window.innerWidth * BOARD_MAX_PORTRAIT_VIEWPORT_WIDTH)
    : containerWidth;
  const tileFromWidth = Math.floor(widthLimit / GAME_CONFIG.BOARD_WIDTH);
  const tileSize = Math.max(0, Math.min(tileFromHeight, tileFromWidth));
  return {
    tileSize,
    boardWidth: tileSize * GAME_CONFIG.BOARD_WIDTH,
    boardHeight: tileSize * GAME_CONFIG.BOARD_HEIGHT,
  };
}

/**
 * Devuelve el tamaño en píxeles que debe tener el tablero dentro del
 * contenedor indicado. Recibe el elemento (no un ref) para reaccionar a
 * montajes tardíos: el llamador usa un callback ref (`ref={setEl}`) y el
 * efecto se re-ejecuta cuando el nodo aparece. Se recalcula con
 * `ResizeObserver` sobre el contenedor y con `resize` sobre la ventana.
 * `useLayoutEffect` evita un frame con tamaño incorrecto al montar.
 */
export function useBoardSize(container: HTMLElement | null): BoardSize {
  const [size, setSize] = useState<BoardSize>(() => computeBoardSize(window.innerWidth));

  useLayoutEffect(() => {
    const compute = () => {
      setSize(computeBoardSize(container?.clientWidth || window.innerWidth));
    };

    compute();
    window.addEventListener("resize", compute);
    const observer =
      typeof ResizeObserver !== "undefined" && container ? new ResizeObserver(compute) : null;
    if (container) observer?.observe(container);

    return () => {
      window.removeEventListener("resize", compute);
      observer?.disconnect();
    };
  }, [container]);

  return size;
}
