import { Player } from "../../domain/constants/PieceConstants";
import type { GroupSummary, Summary } from "./aggregate";
import { wilson, type Wilson } from "./stats";

/**
 * Renderiza un `Summary` (`trymate.summary/1`) a Markdown legible.
 * Convenciones: n < 200 → ⚠; porcentajes con IC de Wilson 95 %.
 */

export interface ReportContext {
  gitSha?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  status?: string;
  gamesPerHour?: number;
  /** Config del experimento (se serializa colapsada). */
  experiment?: unknown;
}

const MIN_N = 200;
const warn = (n: number): string => (n < MIN_N ? " ⚠" : "");
const pc = (x: number): string => `${(100 * x).toFixed(1)}%`;
const num = (x: number): string => x.toFixed(1);
const ciStr = (w: Wilson): string => `[${pc(w.lo)} – ${pc(w.hi)}]`;
const shareStr = (w: Wilson, n: number): string => `${pc(w.p)} ${ciStr(w)}${warn(n)}`;

const variantGroups = (s: Summary): [string, GroupSummary][] =>
  Object.entries(s.groups).filter(([k]) => k.startsWith("variant:") && !k.includes("|")) as [
    string,
    GroupSummary,
  ][];

const variantName = (key: string): string => key.slice("variant:".length);

function sectionResumen(s: Summary, ctx: ReportContext | undefined, lines: string[]): void {
  const all = s.groups["all"];
  lines.push("# Reporte de selfplay — TryMate", "");
  lines.push(`**Batch:** \`${s.batchId}\`  `);
  lines.push(`**Partidas:** ${s.games} · **Fallas:** ${s.failures}`);
  if (ctx?.status) lines.push(`**Estado:** ${ctx.status}`);
  if (ctx?.startedAt || ctx?.finishedAt)
    lines.push(`**Período:** ${ctx.startedAt ?? "?"} → ${ctx.finishedAt ?? "?"}`);
  if (ctx?.gamesPerHour) lines.push(`**Ritmo:** ${ctx.gamesPerHour} partidas/hora`);
  const variants = variantGroups(s).map(([k]) => `\`${variantName(k)}\``);
  const matchups = Object.keys(s.groups)
    .filter((k) => k.includes("|matchup:"))
    .map((k) => `\`${k.split("|matchup:")[1]}\``);
  lines.push(`**Variantes:** ${variants.join(", ") || "-"}`);
  lines.push(`**Matchups:** ${[...new Set(matchups)].join(", ") || "-"}`);
  if (all) {
    lines.push(`**Duración media:** ${num(all.plies.mean)} plies (p50 ${num(all.plies.p50)})`);
    lines.push(`**Apertura aleatoria:** ${pc(all.randomOpeningShare)} de los plies`);
    if (all.duplicates.games > 0)
      lines.push(
        `**Duplicados:** ${all.duplicates.games} partidas en ${all.duplicates.clusters} grupos con secuencia repetida ⚠`,
      );
  }
  if (s.warnings.length) {
    lines.push("", "### Advertencias");
    for (const w of s.warnings) lines.push(`- ⚠ ${w}`);
  }
  lines.push("");
}

function sectionBalance(s: Summary, lines: string[]): void {
  lines.push("## Balance por variante", "");
  lines.push(
    "| Variante | n | % Blancas | % Negras | Empates | Razones | Plies p10/p50/p90 |",
    "|---|---|---|---|---|---|---|",
  );
  for (const [key, g] of variantGroups(s)) {
    const w = g.winsByColor[Player.BLANCAS];
    const n = g.winsByColor[Player.NEGRAS];
    const reasons = Object.entries(g.reasons)
      .map(([r, c]) => `${r} ${c}`)
      .join(", ");
    lines.push(
      `| ${variantName(key)} | ${g.n}${warn(g.n)} | ${shareStr(w.share, g.n)} | ` +
        `${shareStr(n.share, g.n)} | ${shareStr(g.draws.share, g.n)} | ${reasons} | ` +
        `${num(g.plies.p10)} / ${num(g.plies.p50)} / ${num(g.plies.p90)} |`,
    );
  }
  lines.push("");
  for (const [key, g] of variantGroups(s)) {
    const decided = g.winsByColor[Player.BLANCAS].wins + g.winsByColor[Player.NEGRAS].wins;
    const share = wilson(g.winsByColor[Player.BLANCAS].wins, decided);
    const name = variantName(key);
    if (decided === 0) lines.push(`- **${name}:** sin partidas decididas.`);
    else if (share.lo > 0.5)
      lines.push(
        `- **${name}:** ventaja de Blancas significativa (${pc(share.p)} de decididas, IC ${ciStr(share)}).`,
      );
    else if (share.hi < 0.5)
      lines.push(
        `- **${name}:** ventaja de Negras significativa (${pc(1 - share.p)} de decididas).`,
      );
    else
      lines.push(
        `- **${name}:** sin ventaja de color significativa (Blancas ${pc(share.p)} de decididas, IC ${ciStr(share)}).`,
      );
  }
  lines.push("");
}

function sectionPiezas(s: Summary, lines: string[]): void {
  const all = s.groups["all"];
  if (!all) return;
  lines.push("## Piezas", "");
  lines.push(
    "| Tipo | Desplegadas | Supervivencia | Capturas hechas | Sufridas | Puntos | Ply medio al anotar | Bajadas |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const [t, p] of Object.entries(all.pieces)) {
    const surv = wilson(p.survived, p.deployed + p.benchDrops);
    lines.push(
      `| ${t} | ${p.deployed} | ${shareStr(surv, p.deployed + p.benchDrops)} | ${p.capturesMade} | ` +
        `${p.capturesSuffered} | ${p.pointsScored} | ${p.pliesToScore === null ? "-" : num(p.pliesToScore)} | ${p.benchDrops} |`,
    );
  }
  const captors = Object.keys(all.captureMatrix);
  if (captors.length) {
    lines.push("", "### Matriz de capturas (captor → víctima)", "");
    const victims = [...new Set(captors.flatMap((c) => Object.keys(all.captureMatrix[c]!)))].sort();
    lines.push(
      `| Captor \\ Víctima | ${victims.join(" | ")} |`,
      `|---|${victims.map(() => "---").join("|")}|`,
    );
    for (const c of captors.sort()) {
      lines.push(`| ${c} | ${victims.map((v) => all.captureMatrix[c]![v] ?? 0).join(" | ")} |`);
    }
  }
  lines.push("");
}

function topBottom(
  title: string,
  entries: Record<string, { n: number; wins: number }>,
  lines: string[],
): void {
  const rows = Object.entries(entries)
    .filter(([, v]) => v.n >= 30)
    .sort((a, b) => b[1].wins / b[1].n - a[1].wins / a[1].n);
  lines.push(`### ${title}`, "");
  if (rows.length === 0) {
    lines.push("_Sin claves con n ≥ 30._", "");
    return;
  }
  const show = [...rows.slice(0, 10), ...(rows.length > 10 ? rows.slice(-10) : [])];
  lines.push("| Clave | n | Win rate |", "|---|---|---|");
  for (const [k, v] of show)
    lines.push(`| ${k} | ${v.n}${warn(v.n)} | ${shareStr(wilson(v.wins, v.n), v.n)} |`);
  lines.push("");
}

function heatmap(title: string, grid: number[][], lines: string[]): void {
  const max = Math.max(1, ...grid.flat());
  lines.push(`### ${title}`, "", "```");
  for (let y = grid.length - 1; y >= 0; y--) {
    lines.push(grid[y]!.map((v) => Math.round((9 * v) / max)).join(" "));
  }
  lines.push("```", "", "_0–9 normalizado; fila de anotación de Blancas arriba._", "");
}

function sectionTablero(s: Summary, lines: string[]): void {
  for (const [key, g] of variantGroups(s)) {
    if (!g.heatmaps) continue;
    lines.push(`## Tablero — ${variantName(key)}`, "");
    heatmap("Ocupación", g.heatmaps.occupancy, lines);
    heatmap("Capturas", g.heatmaps.captures, lines);
    const maxCol = Math.max(1, ...g.heatmaps.scoringColumns);
    const bars = g.heatmaps.scoringColumns
      .map((v) => "█".repeat(Math.max(v > 0 ? 1 : 0, Math.round((12 * v) / maxCol))))
      .join(" ");
    lines.push("### Columnas de anotación", "", "```", bars, "```", "");
  }
}

function sectionBancaTempo(s: Summary, lines: string[]): void {
  const all = s.groups["all"];
  if (!all) return;
  lines.push("## Banca y tempo", "");
  lines.push(`- Bajadas por partida: **${num(all.bench.dropsPerGame)}**`);
  lines.push(
    `- Ply medio de bajada: **${all.bench.avgDropPly === null ? "-" : num(all.bench.avgDropPly)}**`,
  );
  if (Object.keys(all.bench.byCount).length) {
    lines.push("", "| Bajadas del bando | n | Win rate |", "|---|---|---|");
    for (const [k, v] of Object.entries(all.bench.byCount)) {
      lines.push(`| ${k} | ${v.n}${warn(v.n)} | ${shareStr(wilson(v.wins, v.n), v.n)} |`);
    }
  }
  lines.push("");
  if (all.firstScorerWins)
    lines.push(
      `- **Quien anota primero gana:** ${shareStr(all.firstScorerWins.share, all.firstScorerWins.n)}`,
    );
  if (all.comebackRate)
    lines.push(
      `- **Remontadas** (ganó quien cedió el primer tanto): ${shareStr(all.comebackRate.share, all.comebackRate.n)}`,
    );
  lines.push("");
}

function sectionPersonalidades(s: Summary, lines: string[]): void {
  const all = s.groups["all"];
  if (!all || Object.keys(all.personalities.matrix).length === 0) return;
  lines.push("## Personalidades", "", "| Blancas \\ Negras | n | % Blancas |", "|---|---|---|");
  for (const [k, v] of Object.entries(all.personalities.matrix)) {
    const share = wilson(v.wins[Player.BLANCAS], v.n);
    lines.push(`| ${k} | ${v.n}${warn(v.n)} | ${shareStr(share, v.n)} |`);
  }
  const sides = Object.entries(all.personalities.side);
  if (sides.length) {
    lines.push(
      "",
      "| Personalidad | n | Frente medio | Progreso máx | Capturas | Plies 1er tanto | Bajadas | Random |",
      "|---|---|---|---|---|---|---|---|",
    );
    for (const [p, s] of sides) {
      const m = s.metrics;
      lines.push(
        `| ${p} | ${s.n}${warn(s.n)} | ${num(m.avgFrontProgress)} | ${num(m.maxProgress)} | ` +
          `${num(m.capturesMade)} | ${m.pliesToFirstScore === null ? "-" : num(m.pliesToFirstScore)} | ` +
          `${num(m.benchDrops)} | ${num(m.randomActions)} |`,
      );
    }
  }
  lines.push("");
}

function sectionCalibracion(s: Summary, lines: string[]): void {
  const all = s.groups["all"];
  if (!all || Object.keys(all.calibration).length === 0) return;
  lines.push("## Calibración del eval", "");
  for (const [ply, bins] of Object.entries(all.calibration)) {
    if (bins.length === 0) continue;
    lines.push(
      `### Ply ${ply}`,
      "",
      "| Rango eval | n | % victoria del evaluador |",
      "|---|---|---|",
    );
    for (const b of bins) {
      lines.push(`| ${num(b.lo)} … ${num(b.hi)} | ${b.n}${warn(b.n)} | ${pc(b.winRate)} |`);
    }
    lines.push("");
  }
}

function sectionDatos(s: Summary, ctx: ReportContext | undefined, lines: string[]): void {
  lines.push("## Datos", "");
  lines.push(`- Schema: \`${s.schema}\` · Generado: ${s.generatedAt}`);
  if (ctx?.gitSha) lines.push(`- Git: \`${ctx.gitSha}\``);
  const fps = variantGroups(s).map(([k]) => `\`${k.split("@")[1]}\``);
  lines.push(`- Fingerprints de reglas: ${fps.join(", ")}`);
  if (ctx?.experiment !== undefined) {
    lines.push(
      "",
      "### Config del experimento",
      "",
      "```json",
      JSON.stringify(ctx.experiment),
      "```",
    );
  }
  lines.push("");
}

/** Renderiza el reporte completo de un batch (o merge de batches). */
export function renderReport(summary: Summary, ctx?: ReportContext): string {
  const lines: string[] = [];
  sectionResumen(summary, ctx, lines);
  sectionBalance(summary, lines);
  sectionPiezas(summary, lines);
  const all = summary.groups["all"];
  if (all) {
    lines.push("## Composiciones", "");
    topBottom("Composición (top/bottom por win rate)", all.byComposition, lines);
    topBottom("Formación front-mid-back (top/bottom)", all.byFormation, lines);
  }
  sectionTablero(summary, lines);
  sectionBancaTempo(summary, lines);
  sectionPersonalidades(summary, lines);
  sectionCalibracion(summary, lines);
  sectionDatos(summary, ctx, lines);
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}
