/**
 * Sandock PTY Client — WebSocket-based interactive terminal sessions
 *
 * Connects to ws://host/api/v1/sandbox/{id}/pty/ws using either
 * browser-native WebSocket or the `ws` package in Node.js.
 *
 * Auth: Sec-WebSocket-Protocol subprotocol "bearer.<token>"
 */

/** Options for creating a PTY session */
export interface PtyCreateOptions {
  /** Initial columns (default: 80) */
  cols?: number;
  /** Initial rows (default: 24) */
  rows?: number;
  /** Shell command (default: /bin/sh) */
  cmd?: string;
  /** Called when PTY produces output */
  onData: (data: Uint8Array) => void;
  /** Called when PTY process exits */
  onExit?: (exitCode: number | null) => void;
  /** Called on connection/protocol errors */
  onError?: (error: Error) => void;
}

/** Handle to an active PTY session */
export interface PtyHandle {
  /** Server-assigned session ID */
  sessionId: string;
  /** Send user input (keystrokes, paste) to PTY stdin */
  sendInput(data: string | Uint8Array): void;
  /** Resize PTY terminal dimensions */
  resize(cols: number, rows: number): void;
  /** Kill the PTY session */
  kill(): void;
  /** Wait until PTY exits; resolves with exit code */
  wait(): Promise<{ exitCode: number | null }>;
}

/** PTY session info from list endpoint */
export interface PtySessionInfo {
  sessionId: string;
  sandboxId: string;
}

/**
 * Create a PTY client bound to a Sandock server.
 *
 * @param baseUrl - Base HTTP URL (e.g. "https://sandock.ai")
 * @param headers - Auth headers (must include Authorization: Bearer <token>)
 */
export function createPtyClient(baseUrl: string, headers: Record<string, string>) {
  // Extract bearer token from headers
  const getToken = (): string | undefined => {
    const auth = headers.Authorization || headers.authorization;
    return auth?.replace(/^Bearer\s+/i, "");
  };

  return {
    /**
     * Create and connect to an interactive PTY session.
     * Returns a handle to send input, resize, and wait for exit.
     */
    async create(sandboxId: string, opts: PtyCreateOptions): Promise<PtyHandle> {
      // Build WebSocket URL
      const wsUrl = baseUrl.replace(/^http/, "ws") + `/api/v1/sandbox/pty/ws/${sandboxId}`;

      const token = getToken();
      // Sec-WebSocket-Protocol subprotocol for auth: "bearer.<token>"
      const protocols = token ? [`bearer.${token}`] : [];

      // Use native WebSocket in browser, dynamic import of ws in Node.js
      let ws: WebSocket;
      if (typeof globalThis.WebSocket !== "undefined") {
        ws = new globalThis.WebSocket(wsUrl, protocols);
      } else {
        const { default: WS } = await import("ws");
        ws = new WS(wsUrl, protocols) as unknown as WebSocket;
      }
      ws.binaryType = "arraybuffer";

      let sessionId = "";
      let exitCode: number | null = null;
      let exitResolve: ((val: { exitCode: number | null }) => void) | null = null;

      const exitPromise = new Promise<{ exitCode: number | null }>((resolve) => {
        exitResolve = resolve;
      });

      return new Promise<PtyHandle>((resolve, reject) => {
        const onOpen = () => {
          // Send start message
          ws.send(
            JSON.stringify({
              type: "start",
              cmd: opts.cmd,
              cols: opts.cols ?? 80,
              rows: opts.rows ?? 24,
            }),
          );
        };

        const onMessage = (event: MessageEvent) => {
          if (event.data instanceof ArrayBuffer) {
            // Binary: PTY output
            opts.onData(new Uint8Array(event.data));
          } else {
            // Text: control message
            try {
              const msg = JSON.parse(
                typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data),
              ) as { type: string; sessionId?: string; exitCode?: number | null; message?: string };

              switch (msg.type) {
                case "started":
                  sessionId = msg.sessionId ?? "";
                  resolve(handle);
                  break;
                case "exit":
                  exitCode = msg.exitCode ?? null;
                  opts.onExit?.(exitCode);
                  exitResolve?.({ exitCode });
                  break;
                case "error":
                  opts.onError?.(new Error(msg.message ?? "Unknown PTY error"));
                  break;
                case "pong":
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        };

        const onError = (event: Event) => {
          const err = new Error("WebSocket error");
          opts.onError?.(err);
          reject(err);
        };

        const onClose = () => {
          if (exitResolve) {
            exitResolve({ exitCode });
          }
        };

        ws.addEventListener("open", onOpen);
        ws.addEventListener("message", onMessage);
        ws.addEventListener("error", onError);
        ws.addEventListener("close", onClose);

        const handle: PtyHandle = {
          get sessionId() {
            return sessionId;
          },
          sendInput(data: string | Uint8Array) {
            if (ws.readyState === ws.OPEN) {
              // Always send user input as binary
              const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
              ws.send(buf);
            }
          },
          resize(cols: number, rows: number) {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: "resize", cols, rows }));
            }
          },
          kill() {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: "kill" }));
            }
            ws.close();
          },
          wait() {
            return exitPromise;
          },
        };
      });
    },
  };
}
