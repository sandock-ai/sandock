// Docker based sandbox for AI code execution (code interpreter, fs, shell)
// Responsibilities:
// 1. Start/stop ephemeral Docker containers as isolated sandboxes
// 2. Provide limited filesystem API (read/write/list/remove) within container workdir
// 3. Execute shell commands & capture stdout/stderr/exitCode
// 4. Execute code snippets (currently: node / python) by writing temp file & running interpreter
// 5. Resource limits (CPU, Memory) & auto-timeout
// 6. Basic lifecycle management & cleanup
//
// NOTE: This is a first iteration; extend with more languages, caching, mounting, stream logs, etc.

import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import type { Container, ContainerCreateOptions, Exec as DockerExec } from "dockerode";
import Docker from "dockerode";
import { DEFAULT_SANDBOX_IMAGE } from "../constants";
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

export interface DockerSandboxOptions {
  /** Stable identifier (container name). Enables cross-process get/restart instead of always creating new */
  id?: string;
  image?: string; // default: sandockai/sandock-code:latest
  pythonImage?: string; // image used when python code requested if different
  pull?: boolean; // attempt pull if image missing
  workdir?: string; // inside container
  memoryLimitMb?: number; // container memory limit
  cpuShares?: number; // relative CPU weight
  autoRemove?: boolean; // remove container on stop
  /** Volume mounts for persistent storage */
  volumeMounts?: Array<{ source: string; target: string; readOnly?: boolean }>;
  /** Environment variables to set in the container */
  env?: Record<string, string>;
}

interface ActiveContainer {
  id: string;
  container: Container;
  image: string;
  createdAt: number;
}

export class DockerSandboxProvider implements SandboxProvider {
  private docker: Docker;
  private opts: Required<
    Pick<
      DockerSandboxOptions,
      "image" | "workdir" | "pull" | "pythonImage" | "memoryLimitMb" | "cpuShares" | "autoRemove"
    >
  > & {
    volumeMounts: Array<{ source: string; target: string; readOnly?: boolean }>;
    env?: Record<string, string>;
  };
  private id?: string;
  private active?: ActiveContainer;

  constructor(options: DockerSandboxOptions = {}) {
    this.docker = new Docker();
    const env = process.env;
    const parseIntPositive = (v: string | undefined, d: number) => {
      if (!v) return d;
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : d;
    };
    // Allow specifying vCPU fractional, convert to cpuShares (relative weight out of 1024)
    let cpuSharesFromEnv: number | undefined;
    if (env.SANDBOX_DOCKER_CPU) {
      const vcpu = Number(env.SANDBOX_DOCKER_CPU);
      if (Number.isFinite(vcpu) && vcpu > 0)
        cpuSharesFromEnv = Math.max(2, Math.round(vcpu * 1024));
    }
    if (!cpuSharesFromEnv && env.SANDBOX_DOCKER_CPU_SHARES) {
      const shares = parseInt(env.SANDBOX_DOCKER_CPU_SHARES, 10);
      if (Number.isFinite(shares) && shares > 0) cpuSharesFromEnv = shares;
    }
    this.opts = {
      image: options.image ?? env.SANDBOX_DOCKER_IMAGE ?? DEFAULT_SANDBOX_IMAGE,
      pythonImage: options.pythonImage ?? env.SANDBOX_DOCKER_PY_IMAGE ?? "python:3.12-slim",
      pull: options.pull ?? env.SANDBOX_DOCKER_PULL === "true",
      workdir: options.workdir ?? env.SANDBOX_DOCKER_WORKDIR ?? "/sandbox",
      memoryLimitMb: options.memoryLimitMb ?? parseIntPositive(env.SANDBOX_DOCKER_MEMORY_MB, 512),
      cpuShares: options.cpuShares ?? cpuSharesFromEnv ?? 256,
      autoRemove:
        options.autoRemove !== undefined
          ? options.autoRemove
          : env.SANDBOX_DOCKER_AUTO_REMOVE
            ? env.SANDBOX_DOCKER_AUTO_REMOVE === "true"
            : !options.id,
      volumeMounts: options.volumeMounts ?? [],
      env: options.env,
    };
    this.id = options.id;
  }

  // Approximate CPU (Docker cpu shares relative to 1024 -> convert to cores fraction)
  get cpu(): number {
    // cpuShares default 256 -> 0.25 cores relative to base 1024
    return +(this.opts.cpuShares / 1024).toFixed(3);
  }
  // Memory bytes
  get mem(): number {
    return this.opts.memoryLimitMb * 1024 * 1024;
  }

  /** Ensure the base image exists (pull optionally) */
  private async ensureImage(image: string) {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      if (!this.opts.pull) throw new Error(`Image ${image} not found locally and pull disabled`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(
          image,
          (error: Error | undefined, stream: NodeJS.ReadableStream | undefined) => {
            if (error) return reject(error);
            if (!stream) return reject(new Error("No pull stream"));
            const modem = this.docker.modem as unknown as {
              followProgress?: (s: NodeJS.ReadableStream, cb: (err: Error | null) => void) => void;
            };
            if (modem.followProgress)
              modem.followProgress(stream, (err2) => (err2 ? reject(err2) : resolve()));
            else resolve();
          },
        );
      });
    }
  }

  /** Start a new container for this sandbox */
  async start(imageOverride?: string) {
    if (this.active) return this.active.id;
    const image = imageOverride ?? this.opts.image;
    // If we have a stable id, attempt to locate existing container first
    if (this.id) {
      const existing = await this.findExistingContainer(this.id);
      if (existing) {
        // If image mismatch, recreate (to avoid stale image)
        if (existing.image !== image) {
          try {
            await existing.container.remove({ force: true });
          } catch {}
        } else {
          // restart existing container to ensure fresh process state
          try {
            await existing.container.restart();
          } catch {
            // If restart fails (e.g., was exited), try start
            try {
              await existing.container.start();
            } catch {}
          }
          this.active = existing;
          await this.execInternal(["mkdir", "-p", this.opts.workdir]);
          return existing.id;
        }
      }
    }

    await this.ensureImage(image);
    // Build volume binds from volumeMounts
    const binds: string[] = this.opts.volumeMounts.map((m) => {
      const mode = m.readOnly ? "ro" : "rw";
      return `${m.source}:${m.target}:${mode}`;
    });
    // Build environment variables array
    const envVars = ["NODE_NO_WARNINGS=1", "PYTHONDONTWRITEBYTECODE=1"];
    if (this.opts.env) {
      for (const [key, value] of Object.entries(this.opts.env)) {
        envVars.push(`${key}=${value}`);
      }
    }
    const createOptions: ContainerCreateOptions = {
      Image: image,
      Tty: false,
      WorkingDir: this.opts.workdir,
      HostConfig: {
        AutoRemove: this.opts.autoRemove,
        Memory: this.opts.memoryLimitMb * 1024 * 1024,
        CpuShares: this.opts.cpuShares,
        NetworkMode: "none", // isolation
        PidsLimit: 256,
        ReadonlyRootfs: false,
        Binds: binds.length > 0 ? binds : undefined,
      },
      Env: envVars,
      Cmd: ["sleep", "3600"], // long running idle process
      name: this.id, // only applied if defined
    } as ContainerCreateOptions & { name?: string };
    const container = await this.docker.createContainer(createOptions);
    await container.start();
    this.active = { id: container.id, container, image, createdAt: Date.now() };
    await this.execInternal(["mkdir", "-p", this.opts.workdir]);
    return container.id;
  }

  async stop() {
    if (!this.active) return;
    try {
      await this.active.container.kill({ signal: "SIGKILL" });
    } catch (_) {
      /* ignore */
    }
    try {
      if (!this.opts.autoRemove) await this.active.container.remove({ force: true });
    } catch (_) {
      /* ignore */
    }
    this.active = undefined;
  }

  private ensureStarted() {
    if (!this.active) throw new Error("Sandbox not started");
    return this.active.container;
  }

  /** Locate existing container by name (id) */
  private async findExistingContainer(id: string): Promise<ActiveContainer | undefined> {
    try {
      const list = await this.docker.listContainers({ all: true, filters: { name: [id] } });
      const info = list.find((c) => (c.Names || []).includes(`/${id}`));
      if (!info) return undefined;
      const container = this.docker.getContainer(info.Id);
      // Need image name (RepoTags[0]) requires inspect
      const inspect = await container.inspect();
      return {
        id: info.Id,
        container,
        image: inspect.Config?.Image || info.Image,
        createdAt: Date.parse(inspect.Created || new Date().toISOString()),
      };
    } catch {
      return undefined;
    }
  }

  // Basic filesystem write inside container using tar archive (dockerode putArchive)
  async writeFile(opts: SandboxFsWriteOptions) {
    const container = this.ensureStarted();
    const { path, content, executable } = opts;
    const tar = await import("tar-stream");
    const pack = tar.pack();
    const mode = executable ? 0o755 : 0o644;
    const dataBuffer = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);

    // Resolve absolute path: if relative, prepend workdir
    const absolutePath = path.startsWith("/") ? path : `${this.opts.workdir}/${path}`;

    // Extract directory and filename
    // putArchive extracts to the specified path, so we need to:
    // 1. Set archive entry name to just the filename
    // 2. Set putArchive path to the parent directory
    const lastSlash = absolutePath.lastIndexOf("/");
    const targetDir = lastSlash > 0 ? absolutePath.substring(0, lastSlash) : "/";
    const filename = lastSlash >= 0 ? absolutePath.substring(lastSlash + 1) : absolutePath;

    await this.execInternal(["mkdir", "-p", targetDir]);

    pack.entry({ name: filename, mode, size: dataBuffer.length }, dataBuffer);
    pack.finalize();
    await (
      container as unknown as { putArchive: (a: unknown, o: unknown) => Promise<void> }
    ).putArchive(pack, { path: targetDir });
  }

  async readFile(path: string): Promise<string> {
    const c = this.ensureStarted();
    const exec = await c.exec({
      Cmd: ["cat", path],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: this.opts.workdir,
    });
    const { stdout } = await this.collectExec(exec);
    return stdout;
  }

  async list(path = ".") {
    const c = this.ensureStarted();
    const exec = await c.exec({
      Cmd: ["sh", "-lc", `ls -1 ${path}`],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: this.opts.workdir,
    });
    const { stdout } = await this.collectExec(exec);
    return stdout.split("\n").filter(Boolean);
  }

  async remove(path: string) {
    this.ensureStarted();
    await this.execInternal(["rm", "-rf", path]);
  }

  async shell(opts: SandboxShellOptions): Promise<SandboxExecutionResult> {
    const container = this.ensureStarted();
    const hasEnv = opts.env && Object.keys(opts.env).length > 0;
    const cmdArray = hasEnv
      ? [
          "sh",
          "-lc",
          buildEnvShellSnippet(opts.env!, Array.isArray(opts.cmd) ? opts.cmd.join(" ") : opts.cmd),
        ]
      : Array.isArray(opts.cmd)
        ? opts.cmd
        : ["sh", "-lc", opts.cmd];
    const exec = await container.exec({
      Cmd: cmdArray,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!opts.input,
      WorkingDir: opts.workdir ?? this.opts.workdir,
    });
    return this.collectExec(exec, opts.timeoutMs ?? 10_000, opts.input);
  }

  async runCode(options: SandboxCodeOptions): Promise<SandboxExecutionResult> {
    // select appropriate image if language requires python & current container image not python
    if (options.language === "python" && (!this.active || !this.active.image.includes("python"))) {
      if (this.active) await this.stop();
      await this.start(this.opts.pythonImage);
    } else if (!this.active) {
      await this.start();
    }
    const filename = this.generateFilename(options.language);
    const codeToWrite = this.prepareCode(options);
    await this.writeFile({ path: filename, content: codeToWrite });
    let cmd: string;
    switch (options.language) {
      case "typescript":
        cmd = `tsx ${filename}`;
        break;
      case "javascript":
        cmd = `node ${filename}`;
        break;
      case "python":
        cmd = `python ${filename}`;
        break;
      default:
        throw new Error("Unsupported language");
    }
    return this.shell({
      cmd,
      timeoutMs: options.timeoutMs ?? 15_000,
      input: options.input,
      env: options.env,
    });
  }

  private generateFilename(lang: SandboxCodeOptions["language"]) {
    const id = randomUUID().slice(0, 8);
    return `snippet-${id}.${lang === "python" ? "py" : lang === "typescript" ? "ts" : "js"}`;
  }

  private prepareCode(options: SandboxCodeOptions) {
    if (options.language === "typescript") {
      return options.code; // rely on ts-node/register path
    }
    return options.code;
  }

  private async execInternal(cmd: string[]) {
    const container = this.ensureStarted();
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: this.opts.workdir,
    });
    return this.collectExec(exec);
  }

  private collectExec(
    exec: DockerExec,
    timeoutMs = 10_000,
    input?: string,
  ): Promise<SandboxExecutionResult> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      let stdout = "";
      let stderr = "";
      let finished = false;
      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const handleDone = (exitCode: number | null, isTimedOut = false) => {
        if (finished) return;
        finished = true;
        if (timeout) clearTimeout(timeout);
        // Use the timeout flag that was set, not the parameter
        resolve({
          stdout,
          stderr,
          exitCode,
          timedOut: timedOut || isTimedOut,
          durationMs: Date.now() - start,
        });
      };
      exec.start(
        { hijack: true, stdin: !!input },
        (err: Error | undefined, stream: NodeJS.ReadableStream | undefined) => {
          if (err) return reject(err);
          if (!stream) return reject(new Error("No exec stream"));
          const stdoutStream = new PassThrough();
          const stderrStream = new PassThrough();
          // dockerode does not export a typed modem, restrict to unknown
          const modem: unknown = (exec as unknown as { modem?: unknown }).modem;
          if (modem && typeof (modem as { demuxStream?: unknown }).demuxStream === "function") {
            (
              modem as {
                demuxStream: (s: NodeJS.ReadableStream, o: PassThrough, e: PassThrough) => void;
              }
            ).demuxStream(stream, stdoutStream, stderrStream);
          } else {
            // Fallback: just pipe all to stdout
            stream.pipe(stdoutStream);
          }
          stdoutStream.on("data", (d) => {
            stdout += d.toString();
          });
          stderrStream.on("data", (d) => {
            stderr += d.toString();
          });
          stream.on("end", async () => {
            try {
              const inspect = await exec.inspect();
              handleDone(inspect.ExitCode);
            } catch {
              handleDone(null);
            }
          });
          if (input) {
            // write and close stdin
            if (
              "write" in stream &&
              typeof (stream as { write: (d: string) => void }).write === "function"
            ) {
              (stream as { write: (d: string) => void }).write(input);
            }
            if ("end" in stream && typeof (stream as { end: () => void }).end === "function") {
              (stream as { end: () => void }).end();
            }
          }
        },
      );
      timeout = setTimeout(async () => {
        timedOut = true; // Set flag before killing
        try {
          const container = this.active?.container;
          if (container) await container.kill({ signal: "SIGKILL" });
        } catch (_) {}
        handleDone(null, true);
      }, timeoutMs);
    });
  }

  async *shellStream(opts: SandboxShellOptions): AsyncIterable<StreamEvent> {
    const container = this.ensureStarted();
    const hasEnv = opts.env && Object.keys(opts.env).length > 0;
    const cmdArray = hasEnv
      ? [
          "sh",
          "-lc",
          buildEnvShellSnippet(opts.env!, Array.isArray(opts.cmd) ? opts.cmd.join(" ") : opts.cmd),
        ]
      : Array.isArray(opts.cmd)
        ? opts.cmd
        : ["sh", "-lc", opts.cmd];
    const exec = await container.exec({
      Cmd: cmdArray,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!opts.input,
      WorkingDir: opts.workdir ?? this.opts.workdir,
    });
    const start = Date.now();
    const timeoutMs = opts.timeoutMs ?? 10_000;
    let timedOut = false;
    let exitCode: number | null = null;
    let resolveExec: (() => void) | null = null;

    // Use async queue for real-time streaming
    const eventQueue: Array<StreamEvent | { type: "done" }> = [];
    let waitingResolve: (() => void) | null = null;

    const pushEvent = (
      event: { type: "stdout"; data: string } | { type: "stderr"; data: string } | { type: "done" },
    ) => {
      eventQueue.push(event);
      if (waitingResolve) {
        waitingResolve();
        waitingResolve = null;
      }
    };

    const execPromise = new Promise<void>((resolve, reject) => {
      resolveExec = resolve;
      exec.start({ hijack: true, stdin: !!opts.input }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return reject(new Error("No exec stream"));
        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();
        const modem: unknown = (exec as unknown as { modem?: unknown }).modem;
        if (modem && typeof (modem as { demuxStream?: unknown }).demuxStream === "function") {
          (
            modem as {
              demuxStream: (s: NodeJS.ReadableStream, o: PassThrough, e: PassThrough) => void;
            }
          ).demuxStream(stream, stdoutStream, stderrStream);
        } else stream.pipe(stdoutStream);

        // Real-time streaming: push events as data arrives
        stdoutStream.on("data", (d) => pushEvent({ type: "stdout", data: d.toString() }));
        stderrStream.on("data", (d) => pushEvent({ type: "stderr", data: d.toString() }));

        stream.on("end", async () => {
          try {
            const inspect = await exec.inspect();
            exitCode = inspect.ExitCode;
          } catch {}
          pushEvent({ type: "done" });
          resolve();
        });

        if (opts.input) {
          const maybeWritable = stream as unknown as Partial<{
            write: (d: string) => void;
            end: () => void;
          }>;
          if (typeof maybeWritable.write === "function") maybeWritable.write(opts.input);
          if (typeof maybeWritable.end === "function") maybeWritable.end();
        }
      });
    });

    // Timeout handler
    const timeoutHandle = setTimeout(async () => {
      try {
        const c = this.active?.container;
        if (c) await c.kill({ signal: "SIGKILL" });
        timedOut = true;
      } catch {}
      pushEvent({ type: "done" });
      if (resolveExec) resolveExec();
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
        yield event;
      }
      await execPromise;
    } finally {
      clearTimeout(timeoutHandle);
    }

    yield {
      type: "exit",
      exitCode,
      timedOut,
      durationMs: Date.now() - start,
    } as const;
  }

  async *runCodeStream(options: SandboxCodeOptions): AsyncIterable<StreamEvent> {
    // prepare like runCode then stream shell
    if (options.language === "python" && (!this.active || !this.active.image.includes("python"))) {
      if (this.active) await this.stop();
      await this.start(this.opts.pythonImage);
    } else if (!this.active) {
      await this.start();
    }
    const filename = this.generateFilename(options.language);
    const codeToWrite = this.prepareCode(options);
    await this.writeFile({ path: filename, content: codeToWrite });
    let cmd: string;
    switch (options.language) {
      case "typescript":
        cmd = `tsx ${filename}`;
        break;
      case "javascript":
        cmd = `node ${filename}`;
        break;
      case "python":
        cmd = `python ${filename}`;
        break;
      default:
        throw new Error("Unsupported language");
    }
    for await (const ev of this.shellStream({
      cmd,
      timeoutMs: options.timeoutMs,
      input: options.input,
      env: options.env,
    })) {
      yield ev;
    }
  }
  async createPtySession(opts: PtySessionOptions): Promise<PtySession> {
    const container = this.ensureStarted();
    const id = randomUUID().slice(0, 8);

    // If cmd contains spaces it is a compound command (e.g. tmux ...)
    // and must be executed through a shell so arguments are parsed correctly.
    const cmd = opts.cmd || "/bin/sh";
    const execCmd = cmd.includes(" ") ? ["sh", "-c", cmd] : [cmd];

    const exec = await container.exec({
      Cmd: execCmd,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true, // Allocate PTY
      WorkingDir: opts.workdir ?? this.opts.workdir,
      Env: opts.env ? Object.entries(opts.env).map(([k, v]) => `${k}=${v}`) : undefined,
    });

    const stream = await exec.start({ hijack: true, stdin: true } as { hijack: true; stdin: true });

    // With Tty:true, stdout/stderr are merged into a single stream (no demux needed).
    // The stream is a duplex: read = stdout, write = stdin.
    return {
      id,
      write(data) {
        stream.write(data);
      },
      onData(cb) {
        stream.on("data", (chunk: Buffer) => cb(chunk));
      },
      resize(cols, rows) {
        exec.resize({ w: cols, h: rows } as { w: number; h: number }).catch(() => {});
      },
      async kill() {
        stream.destroy();
      },
      onExit(cb) {
        stream.on("end", () => {
          exec
            .inspect()
            .then((i) => cb(i.ExitCode))
            .catch(() => cb(null));
        });
      },
    };
  }

  async portForward(port: number): Promise<PortForwardHandle> {
    const container = this.ensureStarted();

    // Use docker exec to run a shell-based TCP bridge via /dev/tcp (bash built-in)
    // Falls back to socat if available, then nc
    const bridgeCmd = [
      "sh",
      "-c",
      // Try socat first (most reliable for binary), then nc, then bash /dev/tcp
      `if command -v socat >/dev/null 2>&1; then exec socat - TCP:localhost:${port}; ` +
        `elif command -v nc >/dev/null 2>&1; then exec nc localhost ${port}; ` +
        `else exec cat <>/dev/tcp/localhost/${port} >&0; fi`,
    ];

    const exec = await container.exec({
      Cmd: bridgeCmd,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const stream = await exec.start({ hijack: true, stdin: true } as { hijack: true; stdin: true });

    return {
      write(data) {
        stream.write(data);
      },
      onData(cb) {
        stream.on("data", (chunk: Buffer) => cb(chunk));
      },
      onClose(cb) {
        stream.on("end", cb);
        stream.on("close", cb);
      },
      onError(cb) {
        stream.on("error", cb);
      },
      close() {
        stream.destroy();
      },
    };
  }
}

export default DockerSandboxProvider;
