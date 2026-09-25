import { execSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createGunzip } from "node:zlib";
import { Player } from "../../domain/constants/PieceConstants";
import { rulesFingerprint } from "../../domain/config/RulesView";
import { createAggregator, type Summary } from "../core/aggregate";
import { compareSummaries, renderCompare, type CompareBy } from "../core/compare";
import { expandGames, parseExperiment } from "../core/experiment";
import { buildVariant } from "../core/ruleOverrides";
import { newManifest, readManifest, writeManifest, type BatchManifest } from "./manifest";
import { resolveWorkerCount, runGamePool } from "./pool";
import { readBatch } from "./readBatch";
import { renderReport, type ReportContext } from "../core/renderReport";
import { replayGame } from "../core/replay";
import { ShardWriter } from "./shardWriter";

const AVAILABLE_BOTS = ["easy", "medium", "hard"];
const PROGRESS_MS = 5_000;
const MANIFEST_MS = 30_000;

const workerFile = join(dirname(fileURLToPath(import.meta.url)), "worker.js");

const gitSha = (): string | null => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

const makeBatchId = (name: string): string => {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(
    2,
    "0",
  )}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  const hex = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `${stamp}-${name}-${hex}`;
};

/** Ids ya escritos en shards existentes (streaming, sin cargar el batch). */
async function existingIds(dir: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => /^games-\d+\.jsonl\.gz$/.test(f));
  } catch {
    return ids;
  }
  for (const f of files.sort()) {
    const rl = createInterface({
      input: createReadStream(join(dir, f)).pipe(createGunzip()),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line) continue;
      try {
        const rec = JSON.parse(line) as { id?: string };
        if (rec.id) ids.add(rec.id);
      } catch {
        // línea truncada por interrupción: se ignora
      }
    }
  }
  return ids;
}

async function cmdSelfplay(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: "string" },
      out: { type: "string" },
      games: { type: "string" },
      workers: { type: "string" },
      resume: { type: "string" },
      "no-positions": { type: "boolean" },
      report: { type: "boolean" },
    },
    allowPositionals: false,
  });
  if (!values.config) {
    console.error("falta --config <json>");
    return 2;
  }

  const raw = JSON.parse(await readFile(values.config, "utf8")) as unknown;
  let cfg = parseExperiment(raw, AVAILABLE_BOTS);
  if (values.games) cfg = { ...cfg, games: Number.parseInt(values.games, 10) };
  if (values.workers)
    cfg = {
      ...cfg,
      workers: values.workers === "auto" ? "auto" : Number.parseInt(values.workers, 10),
    };
  if (values["no-positions"]) cfg = { ...cfg, recordPositions: false };

  const baseOut = resolve(
    values.out ?? process.env.TRYMATE_DATA_DIR ?? join(homedir(), "TryMateData", "selfplay"),
  );

  let batchDir: string;
  let batchId: string;
  let sha: string | null;
  let doneIds = new Set<string>();
  let gamesDoneBefore = 0;

  if (values.resume) {
    // Reanudar: misma config, saltear ids ya escritos.
    batchDir = resolve(values.resume);
    const prev = await readManifest(batchDir);
    if (prev.experiment.name !== cfg.name) {
      console.error(`--resume: el manifest es de "${prev.experiment.name}", no de "${cfg.name}"`);
      return 2;
    }
    batchId = prev.batchId;
    sha = prev.gitSha;
    doneIds = await existingIds(batchDir);
    gamesDoneBefore = doneIds.size;
    console.log(`resume ${batchId}: ${doneIds.size} partidas ya escritas`);
  } else {
    batchId = makeBatchId(cfg.name);
    sha = gitSha();
    batchDir = join(baseOut, batchId);
    await mkdir(batchDir, { recursive: true });
  }

  const all = expandGames(cfg, batchId, sha);
  const queue = all.filter((d) => !doneIds.has(d.id));
  const workers = resolveWorkerCount(cfg.workers);

  const fingerprints: Record<string, string> = {};
  for (const o of cfg.rules) {
    const v = buildVariant(o);
    fingerprints[v.name] = rulesFingerprint(v.rules, v.engine.config);
  }

  const manifest: BatchManifest = {
    ...(values.resume
      ? { ...(await readManifest(batchDir)), gamesPlanned: all.length }
      : newManifest(batchId, cfg, sha, fingerprints, AVAILABLE_BOTS, all.length)),
    experiment: cfg,
  };
  manifest.gamesDone = gamesDoneBefore;
  await writeManifest(batchDir, manifest);

  const writer = await ShardWriter.open(batchDir);
  let fails = 0;
  let wWins = 0;
  let bWins = 0;
  const t0 = Date.now();
  let stop = false;

  const progress = setInterval(() => {
    const done = manifest.gamesDone;
    const pct = ((100 * done) / all.length).toFixed(1);
    const hours = (Date.now() - t0) / 3_600_000;
    const gph =
      hours > 0
        ? Math.round(
            manifest.gamesDone - gamesDoneBefore > 0
              ? (manifest.gamesDone - gamesDoneBefore) / hours
              : 0,
          )
        : 0;
    const remaining = all.length - done;
    const eta = gph > 0 ? `${(remaining / gph).toFixed(1)}h` : "?";
    const games = wWins + bWins;
    const wp = games > 0 ? ((100 * wWins) / games).toFixed(1) : "-";
    const bp = games > 0 ? ((100 * bWins) / games).toFixed(1) : "-";
    console.log(
      `${done}/${all.length} (${pct}%) · ${gph} g/h · ETA ${eta} · W ${wp}% / B ${bp}% · fails ${fails}`,
    );
  }, PROGRESS_MS);

  const manifestTick = setInterval(() => {
    void writeManifest(batchDir, manifest);
  }, MANIFEST_MS);

  process.on("SIGINT", () => {
    if (stop) process.exit(130); // segundo Ctrl+C: salir ya
    stop = true;
    console.log("\nCtrl+C: dejo de repartir; esperando partidas en curso… (otro Ctrl+C sale ya)");
  });

  console.log(`batch ${batchId} → ${batchDir} (${queue.length} a jugar, ${workers} workers)`);

  await runGamePool({
    workerFile,
    workers,
    queue,
    shouldStop: () => stop,
    onRecord: async (record) => {
      await writer.writeRecord(record);
      manifest.gamesDone += 1;
      if (record.result.winner === Player.BLANCAS) wWins += 1;
      else if (record.result.winner === Player.NEGRAS) bWins += 1;
    },
    onFailure: async (d, error) => {
      fails += 1;
      manifest.failures = fails;
      await writer.writeFailure({ id: d.id, error, at: new Date().toISOString() });
    },
  });

  clearInterval(progress);
  clearInterval(manifestTick);
  await writer.close();

  const hours = (Date.now() - t0) / 3_600_000;
  manifest.gamesPerHour =
    hours > 0 ? Math.round((manifest.gamesDone - gamesDoneBefore) / hours) : 0;
  manifest.finishedAt = new Date().toISOString();
  manifest.status = stop ? "interrupted" : "completed";
  await writeManifest(batchDir, manifest);

  console.log(
    `${manifest.status === "completed" ? "✓" : "⚠"} ${batchId}: ${manifest.gamesDone}/${all.length} ` +
      `partidas, ${fails} fallas, ${manifest.gamesPerHour} g/h`,
  );
  if (values.report) {
    await writeSummary([batchDir], batchDir);
  }
  return 0;
}

/** Lee batches en streaming y escribe summary.json + report.md en outDir. */
async function writeSummary(dirs: string[], outDir: string): Promise<Summary> {
  const agg = createAggregator();
  let ctx: ReportContext | undefined;
  for (const dir of dirs) {
    const r = await readBatch(dir, (rec) => agg.add(rec));
    agg.noteFailures(r.reportedFailures + r.invalid);
    console.log(
      `${dir}: ${r.read} partidas leídas, ${r.invalid} líneas inválidas, ${r.reportedFailures} fallas`,
    );
    for (const e of r.invalidErrors) console.log(`  ⚠ ${e}`);
    if (dirs.length === 1) {
      try {
        const m = await readManifest(dir);
        ctx = {
          gitSha: m.gitSha,
          startedAt: m.startedAt,
          finishedAt: m.finishedAt,
          status: m.status,
          gamesPerHour: m.gamesPerHour,
          experiment: m.experiment,
        };
      } catch {
        // sin manifest: reporte sin contexto extra
      }
    }
  }
  const summary = agg.finish();
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(join(outDir, "report.md"), renderReport(summary, ctx));
  console.log(
    `summary.json + report.md → ${outDir} (${summary.games} partidas, ${summary.warnings.length} avisos)`,
  );
  for (const w of summary.warnings) console.log(`  ⚠ ${w}`);
  return summary;
}

/** summary.json existente o lo computa leyendo los shards. */
async function loadSummary(dir: string): Promise<Summary> {
  try {
    const raw = JSON.parse(await readFile(join(dir, "summary.json"), "utf8")) as Summary;
    if (raw.schema === "trymate.summary/1") return raw;
  } catch {
    // no existe o es inválido: se computa abajo
  }
  const agg = createAggregator();
  const r = await readBatch(dir, (rec) => agg.add(rec));
  agg.noteFailures(r.reportedFailures + r.invalid);
  return agg.finish();
}

/** compare <batchA> <batchB> [--by all|variant|matchup] [--out file.md] */
async function cmdCompare(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { by: { type: "string" }, out: { type: "string" } },
    allowPositionals: true,
  });
  if (positionals.length !== 2) {
    console.error("uso: compare <batchA> <batchB> [--by all|variant|matchup] [--out file.md]");
    return 2;
  }
  const by = (values.by ?? "all") as CompareBy;
  if (!["all", "variant", "matchup"].includes(by)) {
    console.error(`--by inválido: ${by}`);
    return 2;
  }
  const [dirA, dirB] = positionals.map((p) => resolve(p)) as [string, string];
  const [sa, sb] = await Promise.all([loadSummary(dirA), loadSummary(dirB)]);
  const result = compareSummaries(sa, sb, { by });
  const md = renderCompare(result);
  const out =
    values.out ?? join(dirname(dirA), `compare-${basename(dirA)}-vs-${basename(dirB)}.md`);
  await writeFile(out, md);
  console.log(md);
  console.log(`→ ${out}`);
  return 0;
}

/** report <batchDir…> [--out dir] — agrega los batches y escribe summary.json. */
async function cmdReport(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { out: { type: "string" } },
    allowPositionals: true,
  });
  if (positionals.length === 0) {
    console.error("uso: report <batchDir…> [--out dir]");
    return 2;
  }
  const dirs = positionals.map((p) => resolve(p));
  const outDir = values.out ? resolve(values.out) : dirs.length === 1 ? dirs[0]! : null;
  if (!outDir) {
    console.error("con varios batches indicar --out <dir>");
    return 2;
  }
  await writeSummary(dirs, outDir);
  return 0;
}

/**
 * validate <batchDir>: valida el esquema de todas las líneas y re-juega una
 * muestra (5 %, mín. 20) con el árbitro de replay. Dos pasadas streaming.
 */
async function cmdValidate(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({ args: argv, options: {}, allowPositionals: true });
  const dir = positionals[0] ? resolve(positionals[0]) : null;
  if (!dir) {
    console.error("uso: validate <batchDir>");
    return 2;
  }
  const first = await readBatch(dir, () => {});
  if (first.read === 0) {
    console.error(`${dir}: 0 partidas válidas (${first.invalid} líneas inválidas)`);
    return 1;
  }
  const target = Math.max(20, Math.ceil(first.read * 0.05));
  const step = Math.max(1, Math.floor(first.read / target));
  let i = 0;
  let replayed = 0;
  let replayFails = 0;
  const errors: string[] = [];
  await readBatch(dir, (r) => {
    if (i % step !== 0) {
      i += 1;
      return;
    }
    i += 1;
    replayed += 1;
    const rep = replayGame(r);
    if (!rep.ok) {
      replayFails += 1;
      if (errors.length < 10) errors.push(`${r.id}: ${rep.error ?? "mismatch"}`);
    }
  });
  console.log(
    `validate ${dir}: ${first.read} partidas válidas, ${first.invalid} líneas inválidas, ` +
      `${replayed} re-jugadas → ${replayFails} fallas de replay`,
  );
  for (const e of errors) console.log(`  ⚠ ${e}`);
  return first.invalid > 0 || replayFails > 0 ? 1 : 0;
}

async function main(): Promise<number> {
  const [sub, ...rest] = process.argv.slice(2);
  switch (sub) {
    case "selfplay":
      return cmdSelfplay(rest);
    case "report":
      return cmdReport(rest);
    case "compare":
      return cmdCompare(rest);
    case "validate":
      return cmdValidate(rest);
    default:
      console.error("uso: cli.js selfplay|report|compare|validate …");
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
