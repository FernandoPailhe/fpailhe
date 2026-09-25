import { once } from "node:events";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createGzip, type Gzip } from "node:zlib";
import type { GameRecord } from "../core/record";

/**
 * Escritor único del main: partidas a `games-NNN.jsonl.gz` (rotación cada
 * `shardSize`) y fallas a `failures.jsonl`. Nada de esto toca memoria de
 * partidas — streaming puro.
 */
export class ShardWriter {
  private gz: Gzip | null = null;
  private file: WriteStream | null = null;
  private failures: WriteStream | null = null;
  private inShard = 0;
  private index: number;
  private total = 0;

  private constructor(
    private readonly dir: string,
    private readonly shardSize: number,
    startIndex: number,
  ) {
    this.index = startIndex;
  }

  static async open(dir: string, opts: { shardSize?: number } = {}): Promise<ShardWriter> {
    await mkdir(dir, { recursive: true });
    // Reanudación: los shards nuevos continúan la numeración existente.
    const existing = (await readdir(dir)).filter((f) => /^games-\d+\.jsonl\.gz$/.test(f)).length;
    const w = new ShardWriter(dir, opts.shardSize ?? 1000, existing);
    w.failures = createWriteStream(join(dir, "failures.jsonl"), { flags: "a" });
    w.openShard();
    return w;
  }

  get gamesWritten(): number {
    return this.total;
  }

  private openShard(): void {
    const path = join(this.dir, `games-${String(this.index).padStart(3, "0")}.jsonl.gz`);
    this.file = createWriteStream(path);
    this.gz = createGzip();
    this.gz.pipe(this.file);
    this.inShard = 0;
    this.index += 1;
  }

  private async rotate(): Promise<void> {
    const gz = this.gz!;
    const file = this.file!;
    gz.end();
    await once(file, "finish");
    this.openShard();
  }

  async writeRecord(record: GameRecord): Promise<void> {
    const line = `${JSON.stringify(record)}\n`;
    if (!this.gz!.write(line)) await once(this.gz!, "drain");
    this.inShard += 1;
    this.total += 1;
    if (this.inShard >= this.shardSize) await this.rotate();
  }

  async writeFailure(entry: { id: string; error: string; at: string }): Promise<void> {
    const line = `${JSON.stringify(entry)}\n`;
    if (!this.failures!.write(line)) await once(this.failures!, "drain");
  }

  async close(): Promise<void> {
    if (this.gz) {
      const file = this.file!;
      this.gz.end();
      await once(file, "finish");
      this.gz = null;
    }
    if (this.failures) {
      const f = this.failures;
      this.failures = null;
      await new Promise<void>((resolve) => f.end(resolve));
    }
  }
}
