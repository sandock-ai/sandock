/**
 * Sandock Client - High-level API with automatic streaming support
 * When callbacks are provided to runCode/shell, SSE streaming is automatically enabled
 */

import createClient from "openapi-fetch";
import { createPtyClient, type PtyCreateOptions, type PtyHandle } from "./pty";
import type { components, paths } from "./schema";

// Base openapi-fetch client type
type OpenAPIClient = ReturnType<typeof createClient<paths>>;

/** Default timeout in milliseconds (30 seconds) */
export const DEFAULT_TIMEOUT_MS = 30 * 1000;

export interface SandockClientOptions {
  /**
   * Base URL for the Sandock API
   * @default 'https://sandock.ai'
   */
  baseUrl?: string;

  /**
   * Optional headers to include with every request
   */
  headers?: Record<string, string>;

  /**
   * Optional fetch implementation (useful for custom fetch or Node.js environments)
   */
  fetch?: typeof globalThis.fetch;
}

export interface SandboxCreateOptions {
  /** Docker image to use */
  image: string;
  /** Custom name for the sandbox (optional, auto-generated if not provided) */
  title?: string;
  /** Optional command to run */
  command?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** CPU limit */
  cpu?: number;
  /** Memory limit in MB */
  memory?: number;
  /** Space ID (optional, uses user's personal space if not provided) */
  spaceId?: string;
  /** Volume mounts for persistent storage */
  volumes?: VolumeMountInput[];
  /**
   * Maximum runtime for sandbox in seconds.
   * Default: 1800 (30 minutes), Max: 86400 (24 hours).
   * When exceeded, sandbox status will be changed to STOPPED.
   */
  activeDeadlineSeconds?: number;
}

/** Volume mount configuration */
export interface VolumeMountInput {
  /** Volume ID to mount */
  volumeId: string;
  /** Mount path inside the sandbox */
  mountPath: string;
  /** Optional subpath within the volume */
  subpath?: string;
}

/** Volume information */
export interface VolumeInfo {
  id: string;
  spaceId: string | null;
  name: string;
  status: "pending_create" | "ready" | "error" | "deleting" | "deleted";
  sizeBytes: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunCodeOptions {
  /** Programming language */
  language: "javascript" | "typescript" | "python";
  /** Code to execute */
  code: string;
  /** Timeout in milliseconds (default: 30000ms = 30s) */
  timeoutMs?: number;
}

export interface ShellOptions {
  /** Shell command to execute */
  cmd: string;
  /** Timeout in milliseconds (default: 30000ms = 30s) */
  timeoutMs?: number;
  /** Working directory */
  workdir?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export interface StreamCallbacks {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onError?: (error: unknown) => void;
}

/**
 * Parse SSE stream and call callbacks in real-time
 */
async function parseSSEStream(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<ExecutionResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;
  let timedOut = false;
  let durationMs = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "stdout") {
            stdout += event.data;
            callbacks.onStdout?.(event.data);
          } else if (event.type === "stderr") {
            stderr += event.data;
            callbacks.onStderr?.(event.data);
          } else if (event.type === "exit") {
            exitCode = event.exitCode;
            timedOut = event.timedOut;
            durationMs = event.durationMs;
          } else if (event.type === "error") {
            callbacks.onError?.(new Error(event.message));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return { stdout, stderr, exitCode, timedOut, durationMs };
}

/**
 * Sandock client with high-level API
 * Extends the base openapi-fetch client with sandbox operations
 */
/** Sandbox item returned from list */
export interface SandboxItem {
  id: string;
  status: string;
  image?: string;
  createdAt?: string;
}

/** Options for listing sandboxes */
export interface SandboxListOptions {
  /** Space ID (optional - uses personal space if not provided) */
  spaceId?: string;
}

export interface SandockClient extends OpenAPIClient {
  /** Sandbox operations */
  sandbox: {
    /** List all sandboxes */
    list(options?: SandboxListOptions): Promise<{ success: true; data: { items: SandboxItem[] } }>;
    /** Create a new sandbox */
    create(options: SandboxCreateOptions): Promise<{ success: true; data: { id: string } }>;
    /** Start a sandbox */
    start(sandboxId: string): Promise<{ success: true; data: { id: string; started: boolean } }>;
    /** Stop a sandbox */
    stop(sandboxId: string): Promise<{ success: true; data: { id: string; stopped: boolean } }>;
    /** Get sandbox info */
    get(sandboxId: string): Promise<{ success: true; data: { id: string; status: string } }>;
    /** Delete a sandbox */
    delete(sandboxId: string): Promise<{ success: true; data: { id: string; deleted: boolean } }>;
    /**
     * Run code in a sandbox
     * @param sandboxId - Sandbox ID
     * @param options - Code execution options
     * @param callbacks - Optional streaming callbacks (enables real-time SSE streaming when provided)
     */
    runCode(
      sandboxId: string,
      options: RunCodeOptions,
      callbacks?: StreamCallbacks,
    ): Promise<{ success: true; data: ExecutionResult }>;
    /**
     * Execute shell command in a sandbox
     * @param sandboxId - Sandbox ID
     * @param options - Shell execution options
     * @param callbacks - Optional streaming callbacks (enables real-time SSE streaming when provided)
     */
    shell(
      sandboxId: string,
      options: ShellOptions,
      callbacks?: StreamCallbacks,
    ): Promise<{ success: true; data: ExecutionResult }>;
  };
  /** File system operations */
  fs: {
    /** Write file to sandbox */
    write(
      sandboxId: string,
      path: string,
      content: string,
    ): Promise<{ success: true; data: boolean }>;
    /** Read file from sandbox */
    read(
      sandboxId: string,
      path: string,
    ): Promise<{ success: true; data: { path: string; content: string } }>;
    /** List files in sandbox directory */
    list(
      sandboxId: string,
      path: string,
    ): Promise<{ success: true; data: { path: string; entries: unknown[] } }>;
    /** Delete file from sandbox */
    delete(sandboxId: string, path: string): Promise<{ success: true; data: boolean }>;
  };
  /** Volume operations for persistent storage */
  volume: {
    /** List all volumes in the current space */
    list(): Promise<{ success: true; data: { volumes: VolumeInfo[] } }>;
    /** Create a new volume */
    create(
      name: string,
      metadata?: Record<string, unknown>,
      spaceId?: string,
    ): Promise<{ success: true; data: VolumeInfo }>;
    /** Get volume by ID */
    get(volumeId: string): Promise<{ success: true; data: VolumeInfo }>;
    /** Get volume by name, optionally creating if not exists */
    getByName(
      name: string,
      create?: boolean,
      spaceId?: string,
    ): Promise<{ success: true; data: VolumeInfo }>;
    /** Delete a volume */
    delete(volumeId: string): Promise<{ success: true; data: { id: string; deleted: boolean } }>;
  };
  /** Interactive PTY (shell) operations via WebSocket */
  pty: {
    /** Create and connect to an interactive PTY session */
    create(sandboxId: string, opts: PtyCreateOptions): Promise<PtyHandle>;
  };
  /** Execute a command interactively in a sandbox (shortcut for pty.create with the given command) */
  exec(
    sandboxId: string,
    command: string,
    opts?: { cols?: number; rows?: number },
  ): Promise<PtyHandle>;
  /** Get API meta information */
  getMeta(): Promise<{ success: true; data: { version: string } }>;
}

/**
 * Create a Sandock client with high-level API
 *
 * @param options - Client configuration options
 * @returns Sandock client with sandbox, fs operations and raw HTTP methods
 *
 * @example
 * ```ts
 * const client = createSandockClient({
 *   baseUrl: 'https://sandock.ai',
 *   headers: { 'Authorization': 'Bearer token' }
 * })
 *
 * // Create sandbox with custom title
 * const sandbox = await client.sandbox.create({
 *   image: 'node:20-alpine',
 *   title: 'My API Server'
 * })
 *
 * // Create and run code (batch mode - output after completion)
 * const result = await client.sandbox.runCode(sandbox.data.id, {
 *   language: 'javascript',
 *   code: 'console.log("hello")'
 * })
 *
 * // Run with streaming (real-time output via callbacks)
 * await client.sandbox.runCode(sandboxId, { language: 'python', code: 'print("hi")' }, {
 *   onStdout: (chunk) => console.log('[stdout]', chunk),
 *   onStderr: (chunk) => console.log('[stderr]', chunk),
 * })
 *
 * // Shell command with streaming
 * await client.sandbox.shell(sandboxId, { cmd: 'ls -la' }, {
 *   onStdout: (chunk) => process.stdout.write(chunk),
 * })
 *
 * // Raw API access (openapi-fetch)
 * const { data } = await client.GET('/api/v1/meta')
 * ```
 */
export function createSandockClient(options: SandockClientOptions = {}): SandockClient {
  const { baseUrl = "https://sandock.ai", headers = {}, fetch: customFetch } = options;

  // Create base openapi-fetch client
  const rawClient = createClient<paths>({
    baseUrl,
    headers,
    fetch: customFetch,
  });

  // Build high-level API
  const sandbox = {
    async list(listOptions?: SandboxListOptions) {
      // Note: Schema doesn't have spaceId query param but server supports it
      const requestParams: any = listOptions?.spaceId
        ? { params: { query: { spaceId: listOptions.spaceId } } }
        : undefined;

      const { data, error } = await rawClient.GET("/api/v1/sandbox", requestParams);

      if (error) {
        throw new Error(`Failed to list sandboxes: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: { items: data.data.items as SandboxItem[] } };
    },

    async create(createOptions: SandboxCreateOptions) {
      // Build request body with correct field names for the server API
      // SDK uses user-friendly names (cpu, memory) but server expects (cpuShares, memoryLimitMb)
      const requestBody: Record<string, unknown> = {
        image: createOptions.image,
      };

      // Optional fields - only include if provided
      if (createOptions.title) requestBody.title = createOptions.title;
      if (createOptions.spaceId) requestBody.spaceId = createOptions.spaceId;
      if (createOptions.command) requestBody.command = createOptions.command;
      if (createOptions.env) requestBody.env = createOptions.env;
      if (createOptions.cpu) requestBody.cpuShares = createOptions.cpu;
      if (createOptions.memory) requestBody.memoryLimitMb = createOptions.memory;
      if (createOptions.volumes) requestBody.volumes = createOptions.volumes;
      if (createOptions.activeDeadlineSeconds)
        requestBody.activeDeadlineSeconds = createOptions.activeDeadlineSeconds;

      const { data, error } = await rawClient.POST("/api/v1/sandbox", {
        body: requestBody as components["schemas"]["CreateSandboxRequest"],
      });

      if (error) {
        throw new Error(`Failed to create sandbox: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },

    async start(sandboxId: string) {
      const { data, error } = await rawClient.POST("/api/v1/sandbox/{id}/start", {
        params: { path: { id: sandboxId } },
      });

      if (error) {
        throw new Error(`Failed to start sandbox: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },

    async stop(sandboxId: string) {
      const { data, error } = await rawClient.POST("/api/v1/sandbox/{id}/stop", {
        params: { path: { id: sandboxId } },
      });

      if (error) {
        throw new Error(`Failed to stop sandbox: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },

    async get(sandboxId: string) {
      const { data, error } = await rawClient.GET("/api/v1/sandbox");

      if (error) {
        throw new Error(`Failed to list sandboxes: ${JSON.stringify(error)}`);
      }

      const sandbox = (data.data.items as Array<{ id: string; status: string }>).find(
        (s) => s.id === sandboxId,
      );

      if (!sandbox) {
        throw new Error(`Sandbox not found: ${sandboxId}`);
      }

      return { success: true as const, data: sandbox };
    },

    async delete(sandboxId: string) {
      const { data, error } = await rawClient.DELETE("/api/v1/sandbox/{id}", {
        params: { path: { id: sandboxId } },
      });

      if (error) {
        throw new Error(`Failed to delete sandbox: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },

    /**
     * Run code in a sandbox
     * When callbacks are provided, uses SSE streaming for real-time output
     */
    async runCode(sandboxId: string, runOptions: RunCodeOptions, callbacks?: StreamCallbacks) {
      const timeoutMs = runOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      // If callbacks provided, use SSE streaming endpoint
      if (callbacks) {
        const response = await fetch(`${baseUrl}/api/v1/sandbox/${sandboxId}/code/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            language: runOptions.language,
            code: runOptions.code,
            timeoutMs,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to execute code: ${response.statusText}`);
        }

        const result = await parseSSEStream(response, callbacks);
        return { success: true as const, data: result };
      }

      // Non-streaming: use regular endpoint
      const { data, error } = await rawClient.POST("/api/v1/sandbox/{id}/code", {
        params: { path: { id: sandboxId } },
        body: {
          language: runOptions.language,
          code: runOptions.code,
          timeoutMs,
        },
      });

      if (error) {
        throw new Error(`Failed to execute code: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data as ExecutionResult };
    },

    /**
     * Execute shell command in a sandbox
     * When callbacks are provided, uses SSE streaming for real-time output
     */
    async shell(sandboxId: string, shellOptions: ShellOptions, callbacks?: StreamCallbacks) {
      const timeoutMs = shellOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      // If callbacks provided, use SSE streaming endpoint
      if (callbacks) {
        const response = await fetch(`${baseUrl}/api/v1/sandbox/${sandboxId}/shell/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            cmd: shellOptions.cmd,
            timeoutMs,
            ...(shellOptions.workdir && { workdir: shellOptions.workdir }),
            ...(shellOptions.env && { env: shellOptions.env }),
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to execute shell command: ${response.statusText}`);
        }

        const result = await parseSSEStream(response, callbacks);
        return { success: true as const, data: result };
      }

      // Non-streaming: use regular endpoint
      const { data, error } = await rawClient.POST("/api/v1/sandbox/{id}/shell", {
        params: { path: { id: sandboxId } },
        body: {
          cmd: shellOptions.cmd,
          timeoutMs,
          ...(shellOptions.workdir && { workdir: shellOptions.workdir }),
          ...(shellOptions.env && { env: shellOptions.env }),
        },
      });

      if (error) {
        throw new Error(`Failed to execute shell command: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data as ExecutionResult };
    },
  };

  const fs = {
    async write(sandboxId: string, path: string, content: string) {
      const { data, error } = await rawClient.POST("/api/v1/sandbox/{id}/fs/write", {
        params: { path: { id: sandboxId } },
        body: { path, content },
      });

      if (error) {
        throw new Error(`Failed to write file: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },

    async read(sandboxId: string, filePath: string) {
      const { data, error } = await rawClient.GET("/api/v1/sandbox/{id}/fs/read", {
        params: {
          path: { id: sandboxId },
          query: { path: filePath },
        },
      });

      if (error) {
        throw new Error(`Failed to read file: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },

    async list(sandboxId: string, dirPath: string) {
      const { data, error } = await rawClient.GET("/api/v1/sandbox/{id}/fs/list", {
        params: {
          path: { id: sandboxId },
          query: { path: dirPath },
        },
      });

      if (error) {
        throw new Error(`Failed to list files: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },

    async delete(sandboxId: string, filePath: string) {
      const { data, error } = await rawClient.DELETE("/api/v1/sandbox/{id}/fs", {
        params: {
          path: { id: sandboxId },
          query: { path: filePath },
        },
      });

      if (error) {
        throw new Error(`Failed to delete file: ${JSON.stringify(error)}`);
      }

      return { success: true as const, data: data.data };
    },
  };

  // Volume operations
  const volume = {
    async list() {
      const response = await fetch(`${baseUrl}/api/v1/volume`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list volumes: ${response.statusText}`);
      }

      const result = (await response.json()) as { data: { volumes: VolumeInfo[] } };
      return { success: true as const, data: result.data };
    },

    async create(name: string, metadata?: Record<string, unknown>, spaceId?: string) {
      const body: Record<string, unknown> = { name };
      if (metadata !== undefined) body.metadata = metadata;
      if (spaceId !== undefined) body.spaceId = spaceId;

      const response = await fetch(`${baseUrl}/api/v1/volume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to create volume: ${response.statusText}`);
      }

      const result = (await response.json()) as { data: VolumeInfo };
      return { success: true as const, data: result.data };
    },

    async get(volumeId: string) {
      const response = await fetch(`${baseUrl}/api/v1/volume/${volumeId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get volume: ${response.statusText}`);
      }

      const result = (await response.json()) as { data: VolumeInfo };
      return { success: true as const, data: result.data };
    },

    async getByName(name: string, create = false, spaceId?: string) {
      const url = new URL(`${baseUrl}/api/v1/volume/name/${encodeURIComponent(name)}`);
      if (create) {
        url.searchParams.set("create", "true");
      }
      if (spaceId !== undefined) {
        url.searchParams.set("spaceId", spaceId);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get volume by name: ${response.statusText}`);
      }

      const result = (await response.json()) as { data: VolumeInfo };
      return { success: true as const, data: result.data };
    },

    async delete(volumeId: string) {
      const response = await fetch(`${baseUrl}/api/v1/volume/${volumeId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete volume: ${response.statusText}`);
      }

      const result = (await response.json()) as { data: { id: string; deleted: boolean } };
      return { success: true as const, data: result.data };
    },
  };

  async function getMeta() {
    const { data, error } = await rawClient.GET("/api/v1/meta", {});

    if (error) {
      throw new Error(`Failed to get meta: ${JSON.stringify(error)}`);
    }

    return { success: true as const, data: data.data };
  }

  // PTY (interactive terminal) operations
  const pty = createPtyClient(baseUrl, headers);

  // Convenience exec: open interactive PTY with a given command
  const exec = async (
    sandboxId: string,
    command: string,
    opts?: { cols?: number; rows?: number },
  ): Promise<PtyHandle> => {
    return pty.create(sandboxId, {
      cols: opts?.cols ?? 80,
      rows: opts?.rows ?? 24,
      cmd: command,
      onData: () => {},
      onExit: () => {},
    });
  };

  // Merge raw client with high-level API
  return Object.assign(rawClient, {
    sandbox,
    fs,
    volume,
    pty,
    exec,
    getMeta,
  }) as SandockClient;
}
