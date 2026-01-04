/**
 * Sandock Client - High-level API with automatic streaming support
 * When callbacks are provided to runCode/shell, SSE streaming is automatically enabled
 */

import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Base openapi-fetch client type
type OpenAPIClient = ReturnType<typeof createClient<paths>>;

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
}

export interface RunCodeOptions {
  /** Programming language */
  language: "javascript" | "typescript" | "python";
  /** Code to execute */
  code: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

export interface ShellOptions {
  /** Shell command to execute */
  cmd: string;
  /** Timeout in milliseconds */
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
export interface SandockClient extends OpenAPIClient {
  /** Sandbox operations */
  sandbox: {
    /** Create a new sandbox */
    create(options: SandboxCreateOptions): Promise<{ success: true; data: { id: string } }>;
    /** Start a sandbox */
    start(sandboxId: string): Promise<{ success: true; data: { id: string; started: boolean } }>;
    /** Stop a sandbox */
    stop(sandboxId: string): Promise<{ success: true; data: { id: string; stopped: boolean } }>;
    /** Get sandbox info */
    get(sandboxId: string): Promise<{ success: true; data: { id: string; status: string } }>;
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
     * @param command - Shell command to execute
     * @param callbacks - Optional streaming callbacks (enables real-time SSE streaming when provided)
     */
    shell(
      sandboxId: string,
      command: string,
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
 * // Create and run code (batch mode - output after completion)
 * const sandbox = await client.sandbox.create({ image: 'node:20-alpine' })
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
 * await client.sandbox.shell(sandboxId, 'ls -la', {
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
    async create(createOptions: SandboxCreateOptions) {
      const { data, error } = await rawClient.POST("/api/v1/sandbox", {
        body: {
          spaceId: createOptions.spaceId,
          image: createOptions.image,
          command: createOptions.command,
          env: createOptions.env,
          cpu: createOptions.cpu,
          memory: createOptions.memory,
        },
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

    /**
     * Run code in a sandbox
     * When callbacks are provided, uses SSE streaming for real-time output
     */
    async runCode(sandboxId: string, runOptions: RunCodeOptions, callbacks?: StreamCallbacks) {
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
            timeoutMs: runOptions.timeoutMs,
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
          timeoutMs: runOptions.timeoutMs,
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
    async shell(sandboxId: string, command: string, callbacks?: StreamCallbacks) {
      // If callbacks provided, use SSE streaming endpoint
      if (callbacks) {
        const response = await fetch(`${baseUrl}/api/v1/sandbox/${sandboxId}/shell/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ cmd: command }),
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
        body: { cmd: command },
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

  async function getMeta() {
    const { data, error } = await rawClient.GET("/api/v1/meta", {});

    if (error) {
      throw new Error(`Failed to get meta: ${JSON.stringify(error)}`);
    }

    return { success: true as const, data: data.data };
  }

  // Merge raw client with high-level API
  return Object.assign(rawClient, {
    sandbox,
    fs,
    getMeta,
  }) as SandockClient;
}
