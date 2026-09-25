/**
 * Personalidad de juego (estilo, no nivel). Tipo compartido fuera de `hard/`
 * para que Medium/Easy puedan adoptarlo más adelante.
 */
export type Personality = "offensive" | "defensive" | "balanced";

export const PERSONALITIES: readonly Personality[] = ["balanced", "offensive", "defensive"];
