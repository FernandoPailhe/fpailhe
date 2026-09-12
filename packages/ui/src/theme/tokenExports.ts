/**
 * Subpath sin dependencia de React, pensado para consumirse desde
 * `tailwind.config.ts` (que corre en Node, fuera del bundle de la app).
 * Mantiene el theme como única fuente de verdad sin arrastrar componentes.
 */
export * from "./tokens";
export * from "./cssVariables";
