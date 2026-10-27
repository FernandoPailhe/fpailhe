/**
 * Textos fijos de la UI de universos (español en esta versión).
 * Agrupados por pantalla/componente; el contenido del juego se localiza
 * aparte con `localize()` del dominio.
 */
export const uiCopy = {
  layout: {
    backToUniverses: "← Universos",
    skipToContent: "Saltar al contenido",
    footer: "Universos · historias que se juegan con decisiones.",
  },
  status: {
    live: "EN CURSO",
    ended: "TERMINADA",
  },
  list: {
    title: "Universos",
    subtitle: "Elegí un mundo y gobernaló con tus decisiones.",
    empty: "Todavía no hay universos publicados.",
    loading: "Cargando…",
    error: "No se pudieron cargar los universos.",
    enter: "Entrar",
    draft: "borrador",
  },
  start: {
    eyebrow: "Universo",
    play: "Jugar",
    continue: "Continuar",
    newGame: "Nueva partida",
    confirmNew: "¿Seguro? Se pierde la partida actual",
    seeEnd: "Ver final",
  },
  end: {
    result: { victory: "VICTORIA", defeat: "DERROTA", abandoned: "ABANDONADA" } ,
    glyph: { victory: "★", defeat: "✕", abandoned: "■" },
    turns: "Turnos",
    score: "Puntuación",
    stage: "Etapa",
    badges: "Insignias",
    parameters: "Parámetros finales",
    playAgain: "Jugar de nuevo",
  },
  error: {
    title: "Algo salió mal",
    message: "No pudimos cargar el contenido. Intentá de nuevo.",
    notFoundTitle: "Universo no encontrado",
    notFoundMessage: "Este universo no existe o todavía no está publicado.",
    retry: "Reintentar",
    backToList: "← Volver a universos",
  },
  loading: {
    text: "Cargando…",
  },
  card: {
    situation: "Situación",
    balance: "EQUILIBRIO",
    abandon: "Abandonar partida",
    confirmAbandon: "¿Seguro? La partida se da por abandonada",
    hotkeyHint: "Elegí con las teclas 1–3",
  },
  outcome: {
    title: "Resultado",
    chosen: (label: string) => `Elegiste: ${label}`,
    continue: "Continuar",
    seeEnd: "Ver final",
  },
  hud: {
    stage: "ETAPA",
    turn: "TURNO",
    points: "PUNTOS",
    of: "de",
    riskLow: "CRÍTICO BAJO",
    riskHigh: "CRÍTICO ALTO",
    riskAt: (risk: "low" | "high") => (risk === "low" ? "riesgo bajo" : "riesgo alto"),
    powersLabel: "Poderes",
    powerKind: (kind: "shield" | "option_unlock" | "modifier" | "custom") =>
      kind === "shield"
        ? "escudo"
        : kind === "option_unlock"
          ? "desbloqueo"
          : kind === "modifier"
            ? "modificador"
            : "poder",
    powerLabel: (kind: string, name: string, charges: number) =>
      `${name}, ${kind}, ${charges} ${charges === 1 ? "carga" : "cargas"}`,
  },
} as const;
