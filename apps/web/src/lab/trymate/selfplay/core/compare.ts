import { Player } from "../../domain/constants/PieceConstants";
import type { GroupSummary, Summary } from "./aggregate";
import { overlaps, wilson, type Wilson } from "./stats";

/**
 * Comparación de dos batches con criterios de significancia honestos:
 * proporciones → IC de Wilson que no se solapan; medias → |Δ| > 2·SE combinado.
 */

export type CompareBy = "variant" | "matchup" | "all";

export interface CompareRow {
  metric: string;
  a: string;
  b: string;
  delta: string;
  /** true = significativa · false = no · null = sin test aplicable. */
  significant: boolean | null;
}

export interface CompareGroup {
  group: string;
  nA: number;
  nB: number;
  rows: CompareRow[];
}

export interface CompareResult {
  a: string;
  b: string;
  by: CompareBy;
  warnings: string[];
  groups: CompareGroup[];
}

const pc = (x: number): string => `${(100 * x).toFixed(1)}%`;
const num = (x: number): string => x.toFixed(1);
const pp = (d: number): string => `${d >= 0 ? "+" : ""}${(100 * d).toFixed(1)}pp`;
const ci = (w: Wilson): string => `${pc(w.p)} [${pc(w.lo)}–${pc(w.hi)}]`;

const propRow = (metric: string, xA: number, nA: number, xB: number, nB: number): CompareRow => {
  const wa = wilson(xA, nA);
  const wb = wilson(xB, nB);
  return {
    metric,
    a: ci(wa),
    b: ci(wb),
    delta: pp(wb.p - wa.p),
    significant: nA > 0 && nB > 0 ? !overlaps(wa, wb) : null,
  };
};

const meanRow = (
  metric: string,
  mA: number,
  sdA: number,
  nA: number,
  mB: number,
  sdB: number,
  nB: number,
): CompareRow => {
  const se = Math.sqrt((sdA * sdA) / Math.max(1, nA) + (sdB * sdB) / Math.max(1, nB));
  return {
    metric,
    a: num(mA),
    b: num(mB),
    delta: `${mB - mA >= 0 ? "+" : ""}${num(mB - mA)}`,
    significant: nA > 0 && nB > 0 ? Math.abs(mB - mA) > 2 * se : null,
  };
};

const plainRow = (metric: string, vA: number, vB: number, isPct = false): CompareRow => ({
  metric,
  a: isPct ? pc(vA) : num(vA),
  b: isPct ? pc(vB) : num(vB),
  delta: isPct ? pp(vB - vA) : `${vB - vA >= 0 ? "+" : ""}${num(vB - vA)}`,
  significant: null,
});

const reasonShare = (g: GroupSummary, reason: string): { x: number; n: number } => ({
  x: g.reasons[reason] ?? 0,
  n: g.n,
});

function compareGroup(group: string, ga: GroupSummary, gb: GroupSummary): CompareGroup {
  const B = Player.BLANCAS;
  const rows: CompareRow[] = [
    propRow("Victorias Blancas", ga.winsByColor[B].wins, ga.n, gb.winsByColor[B].wins, gb.n),
    propRow(
      "Victorias Negras",
      ga.winsByColor[Player.NEGRAS].wins,
      ga.n,
      gb.winsByColor[Player.NEGRAS].wins,
      gb.n,
    ),
    propRow("Empates", ga.draws.n, ga.n, gb.draws.n, gb.n),
    propRow(
      "% fin por bloqueo",
      reasonShare(ga, "blocked").x,
      ga.n,
      reasonShare(gb, "blocked").x,
      gb.n,
    ),
    propRow(
      "% fin por maxPlies",
      reasonShare(ga, "maxPlies").x,
      ga.n,
      reasonShare(gb, "maxPlies").x,
      gb.n,
    ),
    meanRow(
      "Plies (media)",
      ga.plies.mean,
      ga.plies.stdev,
      ga.n,
      gb.plies.mean,
      gb.plies.stdev,
      gb.n,
    ),
  ];
  if (ga.firstScorerWins && gb.firstScorerWins) {
    rows.push(
      propRow(
        "1er tanto gana",
        Math.round(ga.firstScorerWins.share.p * ga.firstScorerWins.n),
        ga.firstScorerWins.n,
        Math.round(gb.firstScorerWins.share.p * gb.firstScorerWins.n),
        gb.firstScorerWins.n,
      ),
    );
  }
  if (ga.comebackRate && gb.comebackRate) {
    rows.push(
      propRow(
        "Remontadas",
        Math.round(ga.comebackRate.share.p * ga.comebackRate.n),
        ga.comebackRate.n,
        Math.round(gb.comebackRate.share.p * gb.comebackRate.n),
        gb.comebackRate.n,
      ),
    );
  }
  rows.push(
    plainRow("Bajadas por partida", ga.bench.dropsPerGame, gb.bench.dropsPerGame),
    plainRow("Apertura aleatoria", ga.randomOpeningShare, gb.randomOpeningShare, true),
  );

  const types = [...new Set([...Object.keys(ga.pieces), ...Object.keys(gb.pieces)])].sort();
  for (const t of types) {
    const pa = ga.pieces[t];
    const pb = gb.pieces[t];
    if (!pa || !pb) continue;
    const depA = pa.deployed + pa.benchDrops;
    const depB = pb.deployed + pb.benchDrops;
    rows.push(
      propRow(`supervivencia ${t}`, pa.survived, depA, pb.survived, depB),
      plainRow(`puntos ${t} /partida`, pa.pointsScored / ga.n, pb.pointsScored / gb.n),
      plainRow(`capturas ${t} /partida`, pa.capturesMade / ga.n, pb.capturesMade / gb.n),
    );
  }
  return { group, nA: ga.n, nB: gb.n, rows };
}

const groupKeysFor = (s: Summary, by: CompareBy): Set<string> =>
  new Set(
    Object.keys(s.groups).filter((k) =>
      by === "all"
        ? k === "all"
        : by === "variant"
          ? k.startsWith("variant:") && !k.includes("|")
          : k.includes(`|${by}:`),
    ),
  );

export function compareSummaries(
  a: Summary,
  b: Summary,
  opts: { by?: CompareBy } = {},
): CompareResult {
  const by = opts.by ?? "all";
  const warnings: string[] = [];
  if (a.batchId === b.batchId && a.batchId !== "") {
    warnings.push("mismo batchId en ambos summaries — ¿se comparó un batch consigo mismo?");
  }
  const varsA = groupKeysFor(a, "variant");
  const varsB = groupKeysFor(b, "variant");
  const sameVariants = varsA.size === varsB.size && [...varsA].every((k) => varsB.has(k));
  if (!sameVariants) {
    warnings.push(
      `variantes distintas entre batches (${[...varsA].join(", ") || "—"} vs ${[...varsB].join(", ") || "—"}): ` +
        "comparar reglas distintas solo es válido si ese es el objetivo del experimento",
    );
  }

  const keysA = groupKeysFor(a, by);
  const keysB = groupKeysFor(b, by);
  const common = [...keysA].filter((k) => keysB.has(k)).sort();
  for (const k of [...keysA].filter((k) => !keysB.has(k))) {
    warnings.push(`grupo "${k}" solo existe en A`);
  }
  for (const k of [...keysB].filter((k) => !keysA.has(k))) {
    warnings.push(`grupo "${k}" solo existe en B`);
  }

  const groups = common
    .map((k) => compareGroup(k, a.groups[k]!, b.groups[k]!))
    .sort((x, y) => x.group.localeCompare(y.group));
  if (groups.length === 0) warnings.push(`sin grupos comunes para --by ${by}`);

  return { a: a.batchId, b: b.batchId, by, warnings, groups };
}

const sigMark = (s: boolean | null): string => (s === null ? "—" : s ? "**sí**" : "no");

export function renderCompare(r: CompareResult): string {
  const lines: string[] = [
    `# Comparación de batches`,
    "",
    `**A:** \`${r.a}\` · **B:** \`${r.b}\` · agrupado por \`${r.by}\``,
    "",
  ];
  for (const w of r.warnings) lines.push(`> ⚠ ${w}`);
  if (r.warnings.length) lines.push("");
  for (const g of r.groups) {
    lines.push(`## ${g.group} (n=${g.nA} vs ${g.nB})`, "");
    lines.push("| Métrica | A | B | Δ | Significativa |", "|---|---|---|---|---|");
    for (const row of g.rows) {
      lines.push(
        `| ${row.metric} | ${row.a} | ${row.b} | ${row.delta} | ${sigMark(row.significant)} |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "_Significativa: IC de Wilson 95 % sin solape (proporciones) o |Δ| > 2·SE (medias)._",
    "",
  );
  return lines.join("\n");
}
