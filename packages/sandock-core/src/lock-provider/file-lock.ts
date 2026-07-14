import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { LockProvider } from "./types";

export interface FileLockProviderOptions {
  dir?: string;
  staleMs?: number;
  acquireTimeoutMs?: number;
  retryDelayMs?: number;
}

export class FileLockProvider implements LockProvider {
  private dir: string;
  private staleMs: number;
  private acquireTimeoutMs: number;
  private retryDelayMs: number;

  constructor(opts: FileLockProviderOptions = {}) {
    this.dir = opts.dir ?? join(tmpdir(), "sandbox-locks");
    this.staleMs = opts.staleMs ?? 5 * 60_000;
    this.acquireTimeoutMs = opts.acquireTimeoutMs ?? 5000;
    this.retryDelayMs = opts.retryDelayMs ?? 120;
    void this.ensureDir();
  }

  private async ensureDir() {
    try {
      await mkdir(this.dir, { recursive: true });
    } catch {}
  }

  private path(resource: string) {
    return join(this.dir, `${resource.replace(/[:/]/g, "_")}.lock`);
  }

  private async stale(path: string) {
    try {
      const st = await stat(path);
      if (Date.now() - st.mtimeMs > this.staleMs) return true;
      try {
        const content = await readFile(path, "utf8");
        const ts = Number(content.split(/\n/)[1]);
        if (!Number.isNaN(ts) && Date.now() - ts > this.staleMs) return true;
      } catch {}
      return false;
    } catch {
      return false;
    }
  }

  async acquire(resource: string): Promise<string> {
    const file = this.path(resource);
    const token = `${process.pid}-${randomUUID()}`;
    const deadline = Date.now() + this.acquireTimeoutMs;
    while (Date.now() < deadline) {
      try {
        const fh = await open(file, "wx");
        await fh.write(`${token}\n${Date.now()}`);
        await fh.close();
        return token;
      } catch {
        try {
          const s = await this.stale(file);
          if (s) await rm(file, { force: true });
        } catch {}
        await sleep(this.retryDelayMs);
      }
    }
    throw new Error(`FileLock acquire timeout: ${resource}`);
  }

  async release(resource: string, token: string): Promise<void> {
    const file = this.path(resource);
    try {
      const content = await readFile(file, "utf8").catch(() => "");
      if (!content.startsWith(token)) return;
      await rm(file, { force: true });
    } catch {}
  }
}
