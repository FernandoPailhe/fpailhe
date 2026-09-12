import type { Item } from "./types";

/**
 * Ejemplo de función de dominio pura.
 *
 * TEMPLATE: Reemplazá con la lógica de cálculo de tu dominio.
 * Las funciones en este archivo deben ser puras (sin side-effects,
 * sin imports de React) para poder reutilizarse en cualquier contexto
 * (app, backend, tests, scripts).
 */

/** Ordena items por nombre, alfabéticamente. */
export function sortItemsByName(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}
