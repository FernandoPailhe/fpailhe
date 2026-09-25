import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guarda de aislamiento del bundle: nada fuera de `selfplay/` puede importar
 * `selfplay/**` — si ocurriera, el código del runner (Node) entraría al bundle
 * web. Se recorre apps/web/src y se inspeccionan los imports.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../../");

const IMPORT_RE = /(?:import|export)[^"']*from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g;

async function* sources(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

describe("selfplay — aislamiento del bundle", () => {
  it("ningún archivo fuera de selfplay/ importa selfplay/**", async () => {
    const offenders: string[] = [];
    for await (const path of sources(SRC)) {
      const rel = relative(SRC, path);
      if (rel.startsWith("lab/trymate/selfplay/")) continue;
      const code = await readFile(path, "utf8");
      for (const m of code.matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2] ?? "";
        if (spec.includes("selfplay")) offenders.push(`${rel} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
