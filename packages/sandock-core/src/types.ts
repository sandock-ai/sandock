// Types and interfaces for sandbox providers.
// Shared sandbox type definitions & provider interface
// Designed to allow multiple backend implementations (local, docker, kubernetes)

export type SandboxProviderKind = "DOCKER" | "KUBERNETES" | "LOCAL";

export interface SandboxExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export interface SandboxCodeOptions {
  language: "javascript" | "typescript" | "python";
  code: string;
  timeoutMs?: number; // default 15s
  input?: string; // stdin
  env?: Record<string, string>; // environment variables
}

export interface SandboxShellOptions {
  cmd: string | string[];
  timeoutMs?: number; // default 10s
  workdir?: string;
  env?: Record<string, string>;
  input?: string;
}

export interface SandboxFsWriteOptions {
  path: string; // relative inside sandbox root
  content: string | Uint8Array;
  executable?: boolean;
}

export interface BaseSandboxOptions {
  workdir?: string; // internal working directory root
}

/** Stream event types for real-time execution output */
export type StreamEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; exitCode: number | null; timedOut: boolean; durationMs: number }
  | { type: "error"; message: string };

export interface SandboxProvider {
  /** Start sandbox resources (container, pod, temp dir). Returns sandbox id or workdir path. */
  start(): Promise<string | undefined>;
  /** Stop & cleanup */
  stop(): Promise<void>;
  /** Write file relative to sandbox root */
  writeFile(opts: SandboxFsWriteOptions): Promise<void>;
  readFile(path: string): Promise<string>;
  list(path?: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  shell(opts: SandboxShellOptions): Promise<SandboxExecutionResult>;
  runCode(options: SandboxCodeOptions): Promise<SandboxExecutionResult>;
  /** Optional streaming version of shell - returns real-time output events */
  shellStream?(opts: SandboxShellOptions): AsyncIterable<StreamEvent>;
  /** Optional streaming version of runCode - returns real-time output events */
  runCodeStream?(opts: SandboxCodeOptions): AsyncIterable<StreamEvent>;
  /** Create an interactive PTY session (optional — some providers may not support it) */
  createPtySession?(opts: PtySessionOptions): Promise<PtySession>;
  /**
   * Create a bidirectional TCP tunnel to a port inside the sandbox.
   * Returns a Duplex-like handle for reading/writing raw TCP data.
   * Used for HTTP proxy, WebSocket proxy, tRPC, etc.
   */
  portForward?(port: number): Promise<PortForwardHandle>;
  /**
   * Return the cluster-internal hostname for this sandbox (e.g. K8s headless service DNS).
   * When available, callers can reach the sandbox via `http://<host>:<port>` directly
   * instead of going through portForward / exec tunnels.
   */
  getInternalHost?(): string;
  /** vCPU cores (fractional allowed, eg 0.5) allocated / enforced for this sandbox. */
  readonly cpu: number;
  /** Memory bytes limit (approx). Use mem / 1024^3 for GiB billing. 0 if unbounded. */
  readonly mem: number;
}

/** Bidirectional TCP tunnel handle for port forwarding */
export interface PortForwardHandle {
  /** Write data to the remote port */
  write(data: Buffer | string): void;
  /** Register callback for data received from the remote port */
  onData(cb: (data: Buffer) => void): void;
  /** Register callback for when the connection closes */
  onClose(cb: () => void): void;
  /** Register callback for errors */
  onError(cb: (err: Error) => void): void;
  /** Close the tunnel */
  close(): void;
}

// ---------------------------------------------------------------------------
// PTY (interactive shell) types
// ---------------------------------------------------------------------------

/** PTY session handle returned by provider */
export interface PtySession {
  /** Unique session ID */
  id: string;
  /** Send user input (keystrokes, paste) to PTY stdin */
  write(data: string | Buffer): void;
  /** Register PTY stdout data callback (binary-safe) */
  onData(cb: (data: Buffer) => void): void;
  /** Resize terminal dimensions */
  resize(cols: number, rows: number): void;
  /** Kill PTY process */
  kill(): Promise<void>;
  /** Register exit callback */
  onExit(cb: (exitCode: number | null) => void): void;
}

/** Options for creating a PTY session */
export interface PtySessionOptions {
  /** Initial columns (default: 80) */
  cols?: number;
  /** Initial rows (default: 24) */
  rows?: number;
  /** Shell command to execute (default: /bin/sh) */
  cmd?: string;
  /** Working directory */
  workdir?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

// NOTE: Removed SandboxProviderName alias (was = DbSandboxProvider) to avoid redundancy.
