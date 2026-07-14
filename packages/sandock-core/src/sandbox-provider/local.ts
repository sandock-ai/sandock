import { exec as cbExec, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  PortForwardHandle,
  PtySession,
  PtySessionOptions,
  SandboxCodeOptions,
  SandboxExecutionResult,
  SandboxFsWriteOptions,
  SandboxProvider,
  SandboxShellOptions,
  StreamEvent,
} from "../types";
import { buildEnvShellSnippet } from "../utils/env-tmpfile";

const exec = promisify(cbExec);

type ChildProcessEvents = {
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "exit", listener: (code: number | null) => void): void;
};

export interface LocalSandboxOptions {
  workdir?: string; // custom base (temp dir if omitted)
  keep?: boolean; // do not delete on stop (for debugging)
  id?: string; // stable id maps to deterministic directory (requires workdir base)
  /** Environment variables to set when executing commands */
  env?: Record<string, string>;
}

export class LocalSandboxProvider implements SandboxProvider {
  private root?: string;
  private opts: Required<Pick<LocalSandboxOptions, "keep">> & {
    base?: string;
    env?: Record<string, string>;
  };
  private id?: string;

  constructor(options: LocalSandboxOptions = {}) {
    this.opts = { keep: options.keep ?? false, base: options.workdir, env: options.env };
    this.id = options.id;
  }

  // Local provider currently unbounded; approximate using host logical cores and a default memory cap env override
  get cpu(): number {
    const env = process.env.SANDBOX_LOCAL_CPU;
    if (env) {
      const n = Number(env);
      if (Number.isFinite(n) && n > 0) return n;
    }
    try {
      const cores = require("node:os").cpus()?.length || 1;
      // Use half cores as billing baseline
      return Math.max(0.25, +(cores / 2).toFixed(2));
    } catch {
      return 1;
    }
  }
  get mem(): number {
    const env = process.env.SANDBOX_LOCAL_MEM_MB;
    if (env) {
      const n = Number(env);
      if (Number.isFinite(n) && n > 0) return n * 1024 * 1024;
    }
    try {
      const total = require("node:os").totalmem();
      // Billable cap heuristics: 25% of host memory
      return Math.max(256 * 1024 * 1024, Math.floor(total * 0.25));
    } catch {
      return 512 * 1024 * 1024;
    }
  }

  async start(): Promise<string | undefined> {
    if (this.root) return this.root;
    if (this.id && this.opts.base) {
      // deterministic directory: base/id
      const dir = join(this.opts.base, this.id);
      await import("node:fs/promises").then(async (fs) => {
        await fs.mkdir(dir, { recursive: true });
      });
      this.root = dir;
    } else {
      this.root = this.opts.base ?? (await mkdtemp(join(tmpdir(), "sandbox-")));
    }
    return this.root;
  }

  async stop(): Promise<void> {
    if (!this.root) return;
    if (!this.opts.keep && !(this.id && this.opts.base)) {
      // don't delete deterministic shared dir
      try {
        await rm(this.root, { recursive: true, force: true });
      } catch {}
    }
    this.root = undefined;
  }

  private ensureStarted() {
    if (!this.root) throw new Error("Sandbox not started");
    return this.root;
  }

  async writeFile(opts: SandboxFsWriteOptions): Promise<void> {
    const root = this.ensureStarted();
    const p = join(root, opts.path);
    // Create parent directories if they don't exist
    const dir = join(p, "..");
    await mkdir(dir, { recursive: true });
    await fsWriteFile(p, opts.content);
    if (opts.executable) {
      await import("node:fs").then((fs) => fs.chmodSync(p, 0o755));
    }
  }

  async readFile(path: string): Promise<string> {
    const root = this.ensureStarted();
    return fsReadFile(join(root, path), "utf8");
  }

  async list(path = "."): Promise<string[]> {
    const root = this.ensureStarted();
    return readdir(join(root, path));
  }

  async remove(path: string): Promise<void> {
    const root = this.ensureStarted();
    await rm(join(root, path), { recursive: true, force: true });
  }

  async shell(opts: SandboxShellOptions): Promise<SandboxExecutionResult> {
    const root = this.ensureStarted();
    const start = Date.now();
    const rawCmd = Array.isArray(opts.cmd) ? opts.cmd.join(" ") : opts.cmd;
    const mergedEnv = { ...this.opts.env, ...opts.env };
    const hasEnv = Object.keys(mergedEnv).length > 0;
    const cmdStr = hasEnv ? buildEnvShellSnippet(mergedEnv, rawCmd) : rawCmd;
    try {
      const { stdout, stderr } = await exec(cmdStr, {
        cwd: opts.workdir ? join(root, opts.workdir) : root,
        env: { ...process.env },
        timeout: opts.timeoutMs ?? 10_000,
      });
      return { stdout, stderr, exitCode: 0, timedOut: false, durationMs: Date.now() - start };
    } catch (e: unknown) {
      const err = e as {
        stdout?: string;
        stderr?: string;
        code?: number;
        signal?: string;
        killed?: boolean;
        message?: string;
      };
      const timedOut: boolean = !!(
        /timed out/i.test(err.message ?? "") ||
        (err.killed && err.signal === "SIGTERM")
      );
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message ?? String(e),
        exitCode: typeof err.code === "number" ? err.code : null,
        timedOut,
        durationMs: Date.now() - start,
      };
    }
  }

  async runCode(options: SandboxCodeOptions): Promise<SandboxExecutionResult> {
    await this.start();
    const filename = this.generateFilename(options.language);
    await this.writeFile({ path: filename, content: options.code });
    let cmd: string;
    switch (options.language) {
      case "javascript":
        cmd = `node ${filename}`;
        break;
      case "typescript":
        // Use local project tsx if available, fallback to npx
        cmd = `npx tsx ${filename}`;
        break;
      case "python":
        // Prefer python3
        cmd = `python3 ${filename}`;
        break;
      default:
        throw new Error("Unsupported language");
    }
    return this.shell({
      cmd,
      timeoutMs: options.timeoutMs,
      input: options.input,
      env: options.env,
    });
  }

  private generateFilename(lang: SandboxCodeOptions["language"]) {
    const id = randomUUID().slice(0, 8);
    return `snippet-${id}.${lang === "python" ? "py" : lang === "typescript" ? "ts" : "js"}`;
  }

  async *shellStream(opts: SandboxShellOptions): AsyncIterable<StreamEvent> {
    const root = this.ensureStarted();
    const start = Date.now();
    const mergedEnv = { ...this.opts.env, ...opts.env };
    const hasEnv = Object.keys(mergedEnv).length > 0;
    const rawCmd = Array.isArray(opts.cmd) ? opts.cmd.join(" ") : String(opts.cmd);
    const fullCmd = hasEnv ? buildEnvShellSnippet(mergedEnv, rawCmd) : rawCmd;
    const child = spawn("sh", ["-lc", fullCmd], {
      cwd: opts.workdir ? join(root, opts.workdir) : root,
      env: { ...process.env },
    });
    const childEvents = child as unknown as ChildProcessEvents;
    if (opts.input) child.stdin?.end(opts.input);
    const timeoutMs = opts.timeoutMs ?? 10_000;
    let timedOut = false;

    // Async queue pattern for real-time streaming
    const eventQueue: Array<StreamEvent | { type: "done" }> = [];
    let waitingResolve: (() => void) | null = null;

    const pushEvent = (event: StreamEvent | { type: "done" }) => {
      eventQueue.push(event);
      if (waitingResolve) {
        waitingResolve();
        waitingResolve = null;
      }
    };

    // Set up event handlers
    child.stdout?.on("data", (d) => pushEvent({ type: "stdout", data: d.toString() }));
    child.stderr?.on("data", (d) => pushEvent({ type: "stderr", data: d.toString() }));
    childEvents.on("close", () => pushEvent({ type: "done" }));
    childEvents.on("error", (err: Error) => {
      pushEvent({ type: "error", message: err.message });
      pushEvent({ type: "done" });
    });

    // Timeout handler
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    try {
      // Yield events as they arrive
      while (true) {
        if (eventQueue.length === 0) {
          await new Promise<void>((resolve) => {
            waitingResolve = resolve;
          });
        }
        const event = eventQueue.shift();
        if (!event || event.type === "done") break;
        yield event as StreamEvent;
      }
    } finally {
      clearTimeout(timeout);
    }

    yield {
      type: "exit",
      exitCode: child.exitCode,
      timedOut,
      durationMs: Date.now() - start,
    };
  }

  async *runCodeStream(options: SandboxCodeOptions): AsyncIterable<StreamEvent> {
    await this.start();
    const filename = this.generateFilename(options.language);
    await this.writeFile({ path: filename, content: options.code });
    let cmd: string;
    switch (options.language) {
      case "javascript":
        cmd = `node ${filename}`;
        break;
      case "typescript":
        cmd = `npx tsx ${filename}`;
        break;
      case "python":
        cmd = `python3 ${filename}`;
        break;
      default:
        throw new Error("Unsupported language");
    }
    // Use shellStream for real-time output
    for await (const event of this.shellStream({
      cmd,
      timeoutMs: options.timeoutMs,
      input: options.input,
      env: options.env,
    })) {
      yield event;
    }
  }
  async createPtySession(opts: PtySessionOptions): Promise<PtySession> {
    const root = this.ensureStarted();
    const id = randomUUID().slice(0, 8);

    // If cmd contains spaces, wrap in shell so arguments are parsed correctly.
    const cmd = opts.cmd || "/bin/sh";
    const child = cmd.includes(" ")
      ? spawn("sh", ["-c", cmd], {
          cwd: root,
          stdio: "pipe",
          env: { ...process.env, ...this.opts.env, ...opts.env },
        })
      : spawn(cmd, ["-l"], {
          cwd: root,
          stdio: "pipe",
          env: { ...process.env, ...this.opts.env, ...opts.env },
        });
    const childEvents = child as unknown as ChildProcessEvents;

    return {
      id,
      write(data) {
        child.stdin?.write(data);
      },
      onData(cb) {
        child.stdout?.on("data", cb);
        child.stderr?.on("data", cb);
      },
      resize() {
        /* no-op without PTY */
      },
      async kill() {
        child.kill("SIGKILL");
      },
      onExit(cb) {
        childEvents.on("exit", (code: number | null) => cb(code));
      },
    };
  }
  async portForward(port: number): Promise<PortForwardHandle> {
    const net = await import("node:net");
    const socket = net.createConnection({ host: "localhost", port });

    return new Promise((resolve, reject) => {
      socket.on("connect", () => {
        resolve({
          write(data) {
            socket.write(data);
          },
          onData(cb) {
            socket.on("data", cb);
          },
          onClose(cb) {
            socket.on("close", cb);
            socket.on("end", cb);
          },
          onError(cb) {
            socket.on("error", cb);
          },
          close() {
            socket.destroy();
          },
        });
      });
      socket.on("error", reject);
    });
  }
}

export default LocalSandboxProvider;
