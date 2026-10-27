/** Textos fijos de la plataforma (español en esta versión). */
export const copy = {
  requiresPower: (name: string) => `Requiere: ${name}`,
  lockedGeneric: "No disponible",
  paramDelta: (name: string, delta: number) => `${name} ${delta > 0 ? "+" : ""}${delta}`,
  scoreDelta: (delta: number) => `Puntuación ${delta > 0 ? "+" : ""}${delta}`,
  shieldUsed: (name: string) => `Escudo usado: ${name}`,
  thresholdFired: (name: string) => `${name} en zona crítica`,
  powerGranted: (name: string, charges: number) =>
    charges > 1 ? `Poder obtenido: ${name} ×${charges}` : `Poder obtenido: ${name}`,
  powerConsumed: (name: string) => `Poder consumido: ${name}`,
  badgeAwarded: (name: string) => `Insignia: ${name}`,
  stageAdvanced: (name: string) => `Nueva etapa: ${name}`,
  branchEntered: (name: string) => `Entrás a: ${name}`,
  branchLeft: (name: string) => `Saliste de: ${name}`,
  characterUnlocked: (name: string) => `Se une: ${name}`,
  characterLocked: (name: string) => `Ya no está: ${name}`,
  parameterActivated: (name: string) => `Nuevo parámetro: ${name}`,
  parameterDeactivated: (name: string) => `Se retira: ${name}`,
  endTitle: (result: "victory" | "defeat" | "abandoned") =>
    result === "victory" ? "Victoria" : result === "defeat" ? "Derrota" : "Partida abandonada",
  endText: (result: "victory" | "defeat" | "abandoned") =>
    result === "victory"
      ? "La historia termina bien."
      : result === "defeat"
        ? "La historia termina acá."
        : "Dejaste la partida sin terminar.",
};
