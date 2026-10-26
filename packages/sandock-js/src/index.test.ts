import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSandockClient, isSandboxNotFoundError, SandockError } from "./index";

const DEFAULT_BASE_URL = process.env.SANDOCK_API_URL || "http://localhost:3030";
const TEST_TIMEOUT = 60_000; // 60 seconds for most tests
const LONG_TEST_TIMEOUT = 180_000; // 3 minutes for longer operations

// Universal test token for localhost testing (development mode only)
// In production, use real API keys (starting with "sk-")
// Example: Authorization: Bearer sk-xxxxxxxxxxxxx
const TEST_TOKEN = "sandock_test_token_local_dev_only";

// Check if the server is available before running tests
let serverAvailable = false;
let testSandboxId: string | null = null;

// Helper to get sandbox ID or throw
function getSandboxId(): string {
  if (!testSandboxId) {
    throw new Error("Test sandbox ID not available");
  }
  return testSandboxId;
}

// Helper to create client with proper authentication
const isLocalhost =
  DEFAULT_BASE_URL.includes("localhost") || DEFAULT_BASE_URL.includes("127.0.0.1");
function createTestClient() {
  return createSandockClient({
    baseUrl: DEFAULT_BASE_URL,
    ...(isLocalhost && {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
    }),
  });
}

const client = createTestClient();

beforeAll(async () => {
  console.log(`[TEST] Testing against: ${DEFAULT_BASE_URL}`);

  try {
    const { data, error } = await client.GET("/api/v1/meta");

    if (data?.success) {
      serverAvailable = true;
      console.log(`[TEST] ✓ Sandock server available`);
      console.log(`[TEST] Server version: ${data.data.version}`);
      if (isLocalhost) {
        console.log(`[TEST] Using test token for localhost authentication`);
      }
    } else {
      console.warn(`[TEST] ✗ Sandock server not available at ${DEFAULT_BASE_URL}`);
      console.warn(`[TEST] Error:`, error);
      console.warn(`[TEST] Integration tests will be skipped`);
    }
  } catch (err) {
    console.warn(`[TEST] ✗ Cannot connect to Sandock server at ${DEFAULT_BASE_URL}`);
    console.warn(`[TEST] Error:`, err);
    console.warn(`[TEST] Integration tests will be skipped`);
    console.warn(`[TEST] To run integration tests, start Sandock server: pnpm dev`);
  }
}, 10_000);

afterAll(async () => {
  if (serverAvailable && testSandboxId) {
    console.log(`[TEST] Cleaning up test sandbox: ${testSandboxId}`);
    try {
      await client.POST("/api/v1/sandbox/{id}/stop", {
        params: { path: { id: getSandboxId() } },
      });
      console.log(`[TEST] ✓ Sandbox stopped`);
    } catch (err) {
      console.warn(`[TEST] ✗ Cleanup failed:`, err);
    }
  }
}, 15_000); // Increased timeout for cleanup

// Helper functions for test skipping
function skipIfNoServer(testName: string): boolean {
  if (!serverAvailable) {
    console.warn(`[TEST] Skipping "${testName}": server not available`);
    return true;
  }
  return false;
}

async function ensureSandbox(): Promise<boolean> {
  if (!serverAvailable) {
    console.warn(`[TEST] Cannot create sandbox: server not available`);
    return false;
  }

  if (testSandboxId) {
    return true; // Already have a sandbox
  }

  // Try to create a sandbox for standalone test execution
  console.log("[TEST] No sandbox available, creating one for standalone test...");
  try {
    const { data, error } = await client.POST("/api/v1/sandbox", {
      body: {
        image: "sandockai/sandock-code:latest",
        memoryLimitMb: 512,
        cpuShares: 512,
      },
    });

    if (error || !data?.data.id) {
      console.warn("[TEST] Failed to create sandbox:", error);
      return false;
    }

    testSandboxId = data.data.id;
    console.log("[TEST] ✓ Created sandbox for standalone test:", testSandboxId);

    // Start the sandbox
    const startResult = await client.POST("/api/v1/sandbox/{id}/start", {
      params: { path: { id: getSandboxId() } },
    });

    if (startResult.error || !startResult.data?.success) {
      console.warn("[TEST] Failed to start sandbox");
      return false;
    }

    console.log("[TEST] ✓ Sandbox started and ready");
    return true;
  } catch (err) {
    console.warn("[TEST] Exception creating sandbox:", err);
    return false;
  }
}

async function skipIfNoSandbox(testName: string): Promise<boolean> {
  if (!serverAvailable) {
    console.warn(`[TEST] Skipping "${testName}": server not available`);
    return true;
  }

  // Try to ensure we have a sandbox (will create if needed)
  const hasSandbox = await ensureSandbox();

  if (!hasSandbox) {
    console.warn(`[TEST] Skipping "${testName}": no sandbox available`);
    return true;
  }

  return false;
}

describe("createSandockClient", () => {
  it("should create a client with default base URL", () => {
    const client = createSandockClient();
    expect(client).toBeDefined();
    expect(typeof client.GET).toBe("function");
    expect(typeof client.POST).toBe("function");
  });

  it("should create a client with custom base URL", () => {
    const client = createSandockClient({
      baseUrl: "https://api.example.com",
    });
    expect(client).toBeDefined();
  });

  it("should accept custom headers", () => {
    const client = createSandockClient({
      headers: {
        Authorization: "Bearer token",
        "X-Custom": "value",
      },
    });
    expect(client).toBeDefined();
  });

  it("should accept custom fetch implementation", () => {
    const customFetch = async () => new Response();
    const client = createSandockClient({
      fetch: customFetch as typeof fetch,
    });
    expect(client).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Unit tests against a mocked fetch: new-server paths and old-server fallbacks.
// (SDK and server ship separately, so every new call must degrade on a server that predates it.)
// ---------------------------------------------------------------------------

interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: any;
  signal?: AbortSignal;
}

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: status < 400, code: status, message: "x", data }), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A fetch that records every call and answers through `handler` (default: 404 route-missing). */
function mockServer(handler: (call: RecordedCall) => Response | Promise<Response> | undefined) {
  const calls: RecordedCall[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const text = req.body ? await req.text() : "";
    const call: RecordedCall = {
      method: req.method,
      path: url.pathname,
      query: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
      signal: init?.signal ?? req.signal,
    };
    calls.push(call);
    return (
      (await handler(call)) ?? envelope({}, 404) // what an old server answers for a route it doesn't have
    );
  };
  const client = createSandockClient({
    baseUrl: "http://sandock.test",
    fetch: fetchImpl as typeof fetch,
  });
  return { client, calls };
}

const notFoundCode = () =>
  new Response(
    JSON.stringify({
      success: false,
      code: 404,
      message: "Sandbox not found",
      data: { code: "SANDBOX_NOT_FOUND" },
    }),
    { status: 404 },
  );

const execResult = (stdout: string, exitCode = 0) =>
  envelope({ stdout, stderr: "", exitCode, timedOut: false, durationMs: 1 });

/** Rebuild the bytes an old server would end up with from the SDK's shell-fallback commands. */
function bytesFromShellFallback(calls: RecordedCall[]): Buffer {
  const parts = calls
    .filter((c) => c.path.endsWith("/shell"))
    .map((c) => /printf '%s' '([A-Za-z0-9+/=]*)' \| base64 -d >> /.exec(c.body.cmd)?.[1])
    .filter((x): x is string => x !== undefined);
  return Buffer.concat(parts.map((p) => Buffer.from(p, "base64")));
}

describe("sandbox.get / getById", () => {
  it("uses GET /sandbox/{id} on new servers", async () => {
    const { client, calls } = mockServer((c) =>
      c.method === "GET" && c.path === "/api/v1/sandbox/sb1"
        ? envelope({ id: "sb1", status: "RUNNING" })
        : undefined,
    );
    const res = await client.sandbox.get("sb1");
    expect(res.data).toEqual({ id: "sb1", status: "RUNNING" });
    expect(calls.map((c) => c.path)).toEqual(["/api/v1/sandbox/sb1"]);
  });

  it("throws a SANDBOX_NOT_FOUND SandockError (getById → null) without listing", async () => {
    const { client, calls } = mockServer((c) =>
      c.path === "/api/v1/sandbox/gone" ? notFoundCode() : undefined,
    );
    const err = await client.sandbox.get("gone").catch((e) => e);
    expect(err).toBeInstanceOf(SandockError);
    expect(err.code).toBe("SANDBOX_NOT_FOUND");
    expect(isSandboxNotFoundError(err)).toBe(true);
    expect(await client.sandbox.getById("gone")).toBeNull();
    expect(calls.some((c) => c.path === "/api/v1/sandbox")).toBe(false);
  });

  it("falls back to list-and-filter on an old server (route 404 without the code)", async () => {
    const { client, calls } = mockServer((c) =>
      c.path === "/api/v1/sandbox"
        ? envelope({ items: [{ id: "sb1", status: "RUNNING" }] })
        : undefined,
    );
    expect((await client.sandbox.get("sb1")).data).toEqual({ id: "sb1", status: "RUNNING" });
    expect(calls.map((c) => c.path)).toEqual(["/api/v1/sandbox/sb1", "/api/v1/sandbox"]);

    const err = await client.sandbox.get("other").catch((e) => e);
    expect(isSandboxNotFoundError(err)).toBe(true);
    expect(await client.sandbox.getById("other")).toBeNull();
  });

  it("falls back on 405 too", async () => {
    const { client } = mockServer((c) =>
      c.path === "/api/v1/sandbox"
        ? envelope({ items: [{ id: "sb1", status: "STOPPED" }] })
        : envelope({}, 405),
    );
    expect((await client.sandbox.getById("sb1"))?.status).toBe("STOPPED");
  });

  it("does not mistake auth errors for not-found", async () => {
    const { client, calls } = mockServer(() => envelope({}, 401));
    const err = await client.sandbox.get("sb1").catch((e) => e);
    expect(err).toBeInstanceOf(SandockError);
    expect(err.code).toBe("HTTP_401");
    expect(err.status).toBe(401);
    await expect(client.sandbox.getById("sb1")).rejects.toThrow(SandockError);
    expect(calls.some((c) => c.path === "/api/v1/sandbox")).toBe(false);
  });
});

describe("fs binary read/write", () => {
  const bytes = new Uint8Array([...Array.from({ length: 256 }, (_, i) => i), 0xc3, 0x28, 0x00]);

  it("sends base64 with encoding on a server that has the get-by-id route", async () => {
    const { client, calls } = mockServer((c) => {
      if (c.path === "/api/v1/sandbox/sb1") return envelope({ id: "sb1", status: "RUNNING" });
      if (c.path.endsWith("/fs/write")) return envelope(true);
      return undefined;
    });
    await client.fs.write("sb1", "bin/a.dat", bytes, { executable: true });
    const write = calls.find((c) => c.path.endsWith("/fs/write"));
    expect(write?.body.encoding).toBe("base64");
    expect(write?.body.executable).toBe(true);
    expect(Buffer.from(write?.body.content, "base64").equals(Buffer.from(bytes))).toBe(true);
    expect(calls.some((c) => c.path.endsWith("/shell"))).toBe(false);

    // Capability is cached: a second write doesn't probe again.
    await client.fs.write("sb1", "bin/b.dat", bytes);
    expect(calls.filter((c) => c.path === "/api/v1/sandbox/sb1")).toHaveLength(1);
  });

  it("never sends base64 to an old server; writes via the base64 -d shell fallback", async () => {
    const { client, calls } = mockServer((c) => {
      // An old server would accept (and corrupt) an encoded write, so it must never get one.
      if (c.path.endsWith("/fs/write")) return envelope(true);
      if (c.path.endsWith("/shell")) return execResult("");
      return undefined; // no GET /sandbox/{id} → 404
    });
    const big = new Uint8Array(150_000).map((_, i) => (i * 7) % 256);
    await client.fs.write("sb1", "out/big.bin", big);
    expect(calls.some((c) => c.path.endsWith("/fs/write"))).toBe(false);
    const shellCmds = calls.filter((c) => c.path.endsWith("/shell")).map((c) => c.body.cmd);
    expect(shellCmds[0]).toContain("mkdir -p");
    expect(shellCmds.length).toBeGreaterThan(3); // chunked: no single huge exec argument
    expect(bytesFromShellFallback(calls).equals(Buffer.from(big))).toBe(true);
  });

  it("writes strings exactly as before (no probe, no encoding field)", async () => {
    const { client, calls } = mockServer((c) =>
      c.path.endsWith("/fs/write") ? envelope(true) : undefined,
    );
    await client.fs.write("sb1", "a.txt", "héllo");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ path: "a.txt", content: "héllo" });
  });

  it("surfaces a failed shell fallback as an error", async () => {
    const { client } = mockServer((c) =>
      c.path.endsWith("/shell") ? execResult("", 1) : undefined,
    );
    await expect(client.fs.write("sb1", "x.bin", bytes)).rejects.toThrow(/Failed to write/);
  });

  it("readBytes decodes base64 when the server echoes encoding", async () => {
    const { client, calls } = mockServer((c) =>
      c.path.endsWith("/fs/read")
        ? envelope({
            path: c.query.get("path"),
            content: Buffer.from(bytes).toString("base64"),
            encoding: c.query.get("encoding"),
          })
        : undefined,
    );
    const res = await client.fs.readBytes("sb1", "bin/a.dat");
    expect(Buffer.from(res.data.content).equals(Buffer.from(bytes))).toBe(true);
    expect(calls[0].query.get("encoding")).toBe("base64");
  });

  it("readBytes falls back to the shell when an old server ignores encoding", async () => {
    const { client, calls } = mockServer((c) => {
      // Old server: lossy UTF-8 text, no `encoding` echoed.
      if (c.path.endsWith("/fs/read")) return envelope({ path: "a", content: "\ufffd(" });
      if (c.path.endsWith("/shell") && c.body.cmd === "base64 'bin/a.dat'")
        return execResult(`${Buffer.from(bytes).toString("base64")}\n`);
      return undefined;
    });
    const res = await client.fs.readBytes("sb1", "bin/a.dat");
    expect(Buffer.from(res.data.content).equals(Buffer.from(bytes))).toBe(true);

    // Learned: the next binary read goes straight to the shell.
    await client.fs.readBytes("sb1", "bin/a.dat");
    expect(calls.filter((c) => c.path.endsWith("/fs/read"))).toHaveLength(1);
  });
});

describe("shell / runCode cancellation", () => {
  const hangingServer = () =>
    mockServer(
      (c) =>
        new Promise<Response>((_resolve, reject) => {
          c.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );

  it("passes the signal to the non-streaming request", async () => {
    const { client, calls } = hangingServer();
    const controller = new AbortController();
    const pending = client.sandbox.shell("sb1", { cmd: "sleep 30", signal: controller.signal });
    await new Promise((r) => setTimeout(r, 20));
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
    expect(calls[0].path).toBe("/api/v1/sandbox/sb1/shell");
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it("passes the signal to the streaming request", async () => {
    const { client, calls } = hangingServer();
    const controller = new AbortController();
    const pending = client.sandbox.shell(
      "sb1",
      { cmd: "sleep 30", signal: controller.signal },
      { onStdout: () => {} },
    );
    await new Promise((r) => setTimeout(r, 20));
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
    expect(calls[0].path).toBe("/api/v1/sandbox/sb1/shell/stream");
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it("passes the signal for runCode", async () => {
    const { client, calls } = hangingServer();
    const controller = new AbortController();
    const pending = client.sandbox.runCode("sb1", {
      language: "python",
      code: "import time; time.sleep(30)",
      signal: controller.signal,
    });
    await new Promise((r) => setTimeout(r, 20));
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
    expect(calls[0].signal?.aborted).toBe(true);
  });
});

describe("Sandock API Integration Tests", () => {
  describe("Meta API", () => {
    it(
      "should get server meta information",
      async () => {
        if (skipIfNoServer("get server meta information")) return;

        const { data, error } = await client.GET("/api/v1/meta");

        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.version).toBeDefined();
        expect(data?.data.timestamp).toBeDefined();
        console.log("[TEST] ✓ Server meta retrieved");
      },
      TEST_TIMEOUT,
    );
  });

  describe("Sandbox Lifecycle", () => {
    it(
      "should create a new sandbox",
      async () => {
        if (skipIfNoServer("create a new sandbox")) return;

        console.log("[TEST] Creating sandbox...");
        const { data, error } = await client.POST("/api/v1/sandbox", {
          body: {
            image: "sandockai/sandock-code:latest",
            memoryLimitMb: 512,
            cpuShares: 512,
          },
        });

        if (error) {
          console.log("[TEST] ✗ Create error:", JSON.stringify(error, null, 2));
          console.warn("[TEST] Remaining tests will be skipped");
        }

        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.id).toBeDefined();

        if (data?.data.id) {
          testSandboxId = data.data.id;
          console.log("[TEST] ✓ Created sandbox:", testSandboxId);
        }
      },
      LONG_TEST_TIMEOUT,
    );

    it(
      "should create a sandbox with custom title",
      async () => {
        if (skipIfNoServer("create a sandbox with custom title")) return;

        const customTitle = `Test Sandbox ${Date.now()}`;
        console.log("[TEST] Creating sandbox with custom title:", customTitle);

        const { data, error } = await client.POST("/api/v1/sandbox", {
          body: {
            title: customTitle,
            image: "sandockai/sandock-code:latest",
            memoryLimitMb: 512,
            cpuShares: 512,
          },
        });

        if (error) {
          console.log("[TEST] ✗ Create error:", JSON.stringify(error, null, 2));
        }

        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.id).toBeDefined();

        // Verify the title was set in the create response
        if (data?.data.title) {
          expect(data.data.title).toBe(customTitle);
          console.log("[TEST] ✓ Created sandbox with custom title:", customTitle);
        } else {
          console.warn("[TEST] ⚠ Title not returned in create response");
        }

        // Cleanup: delete the test sandbox
        if (data?.data.id) {
          try {
            await client.DELETE("/api/v1/sandbox/{id}", {
              params: { path: { id: data.data.id } },
            });
            console.log("[TEST] ✓ Cleaned up test sandbox");
          } catch (err) {
            console.warn("[TEST] ✗ Cleanup failed:", err);
          }
        }
      },
      LONG_TEST_TIMEOUT,
    );

    it(
      "should list sandboxes",
      async () => {
        if (skipIfNoServer("list sandboxes")) return;

        // Note: spaceId is no longer passed - it's derived from API key
        const { data, error } = await client.GET("/api/v1/sandbox");

        if (error) {
          console.log("[TEST] ✗ List error:", JSON.stringify(error, null, 2));
        }

        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(Array.isArray(data?.data.items)).toBe(true);
        console.log("[TEST] ✓ Found", data?.data.items?.length, "sandboxes");
      },
      TEST_TIMEOUT,
    );

    it(
      "should start a sandbox",
      async () => {
        if (await skipIfNoSandbox("start a sandbox")) return;

        console.log("[TEST] Starting sandbox:", testSandboxId);
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/start", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
        });

        if (error) {
          console.log("[TEST] ✗ Start error:", JSON.stringify(error, null, 2));
        }

        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.started).toBe(true);
        console.log("[TEST] ✓ Sandbox started");
      },
      LONG_TEST_TIMEOUT,
    );
  });

  describe("Code Execution", () => {
    it(
      "should run JavaScript code",
      async () => {
        if (await skipIfNoSandbox("run JavaScript code")) return;

        console.log("[TEST] Running JavaScript code...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            language: "javascript",
            code: 'console.log("Hello from JavaScript SDK test!");',
          },
        });

        console.log("[TEST] JavaScript result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.stdout).toContain("Hello from JavaScript SDK test!");
        expect(data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "should run TypeScript code",
      async () => {
        if (await skipIfNoSandbox("run TypeScript code")) return;

        console.log("[TEST] Running TypeScript code...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            language: "typescript",
            code: `
const greeting: string = "Hello from TypeScript";
console.log(greeting);
const numbers: number[] = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log("Sum:", sum);
`,
          },
        });

        console.log("[TEST] TypeScript result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.stdout).toContain("Hello from TypeScript");
        expect(data?.data.stdout).toContain("Sum: 15");
        expect(data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "should run Python code",
      async () => {
        if (await skipIfNoSandbox("run Python code")) return;

        console.log("[TEST] Running Python code...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            language: "python",
            code: `
print("Hello from Python")
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f"Sum: {total}")
`,
          },
        });

        console.log("[TEST] Python result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.stdout).toContain("Hello from Python");
        expect(data?.data.stdout).toContain("Sum: 15");
        expect(data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle code with errors",
      async () => {
        if (await skipIfNoSandbox("handle code with errors")) return;

        console.log("[TEST] Running code with intentional error...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            language: "javascript",
            code: 'throw new Error("Intentional error for testing");',
          },
        });

        console.log("[TEST] Error result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.exitCode).not.toBe(0);
        expect(data?.data.stderr).toContain("Intentional error");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle code timeout",
      async () => {
        if (await skipIfNoSandbox("handle code timeout")) return;

        console.log("[TEST] Running code with timeout...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            language: "javascript",
            code: "while(true) { /* infinite loop */ }",
            timeoutMs: 1000,
          },
        });

        console.log("[TEST] Timeout result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        // Exit code 137 (128 + SIGKILL) indicates process was killed due to timeout
        // Note: Server may not always set timedOut flag correctly, so we check exit code
        expect(data?.data.exitCode).toBe(137);
        expect(data?.data.durationMs).toBeGreaterThanOrEqual(1000);
        expect(data?.data.timedOut).toBe(true);
      },
      TEST_TIMEOUT,
    );
  });

  describe("Shell Commands", () => {
    it(
      "should execute shell command",
      async () => {
        if (await skipIfNoSandbox("execute shell command")) return;

        console.log("[TEST] Executing shell command...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/shell", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            cmd: 'echo "Hello from shell"',
          },
        });

        console.log("[TEST] Shell result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.stdout).toContain("Hello from shell");
        expect(data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "should execute shell command with array",
      async () => {
        if (await skipIfNoSandbox("execute shell command with array")) return;

        console.log("[TEST] Executing shell command array...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/shell", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            cmd: ["echo", "test", "&&", "pwd"],
          },
        });

        console.log("[TEST] Shell array result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );
  });

  describe("File System Operations", () => {
    it(
      "should write and read file",
      async () => {
        if (await skipIfNoSandbox("write and read file")) return;

        console.log("[TEST] Writing file...");
        const writeResult = await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            path: "test.txt",
            content: "SDK test content",
          },
        });

        console.log("[TEST] Write result:", JSON.stringify(writeResult.data, null, 2));
        expect(writeResult.error).toBeUndefined();
        expect(writeResult.data?.success).toBe(true);

        console.log("[TEST] Reading file...");
        const readResult = await client.GET("/api/v1/sandbox/{id}/fs/read", {
          params: {
            path: {
              id: getSandboxId(),
            },
            query: {
              path: "test.txt",
            },
          },
        });

        console.log("[TEST] Read result:", JSON.stringify(readResult.data, null, 2));
        expect(readResult.error).toBeUndefined();
        expect(readResult.data?.success).toBe(true);
        expect(readResult.data?.data.content).toContain("SDK test content");
      },
      TEST_TIMEOUT,
    );

    it(
      "should write file with nested directories",
      async () => {
        if (await skipIfNoSandbox("write file with nested directories")) return;

        console.log("[TEST] Writing nested file...");
        const nestedPath = "deep/nested/path/file.txt";
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            path: nestedPath,
            content: "nested content",
          },
        });

        console.log("[TEST] Nested write result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data?.success).toBe(true);

        const readResult = await client.GET("/api/v1/sandbox/{id}/fs/read", {
          params: {
            path: {
              id: getSandboxId(),
            },
            query: {
              path: nestedPath,
            },
          },
        });

        expect(readResult.data?.data.content).toContain("nested content");
      },
      TEST_TIMEOUT,
    );

    it(
      "should write executable file",
      async () => {
        if (await skipIfNoSandbox("write executable file")) return;

        console.log("[TEST] Writing executable script...");
        const script = '#!/bin/sh\necho "executable test"';
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            path: "script.sh",
            content: script,
            executable: true,
          },
        });

        console.log("[TEST] Executable write result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data?.success).toBe(true);

        console.log("[TEST] Running executable script...");
        const execResult = await client.POST("/api/v1/sandbox/{id}/shell", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            cmd: "./script.sh",
          },
        });

        console.log("[TEST] Script execution result:", JSON.stringify(execResult.data, null, 2));
        expect(execResult.data?.data.stdout).toContain("executable test");
        expect(execResult.data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "should list files in directory",
      async () => {
        if (await skipIfNoSandbox("list files in directory")) return;

        console.log("[TEST] Creating multiple files...");
        await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: { path: { id: getSandboxId() } },
          body: { path: "file1.txt", content: "content1" },
        });
        await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: { path: { id: getSandboxId() } },
          body: { path: "file2.txt", content: "content2" },
        });

        console.log("[TEST] Listing directory...");
        const { data, error } = await client.GET("/api/v1/sandbox/{id}/fs/list", {
          params: {
            path: {
              id: getSandboxId(),
            },
            query: {
              path: ".",
            },
          },
        });

        console.log("[TEST] List result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data?.success).toBe(true);
        expect(data?.data.entries).toContain("file1.txt");
        expect(data?.data.entries).toContain("file2.txt");
      },
      TEST_TIMEOUT,
    );

    it(
      "should remove file",
      async () => {
        if (await skipIfNoSandbox("remove file")) return;

        console.log("[TEST] Creating file to delete...");
        await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: { path: { id: getSandboxId() } },
          body: { path: "to-delete.txt", content: "delete me" },
        });

        console.log("[TEST] Deleting file...");
        const { data, error } = await client.DELETE("/api/v1/sandbox/{id}/fs", {
          params: {
            path: {
              id: getSandboxId(),
            },
            query: {
              path: "to-delete.txt",
            },
          },
        });

        console.log("[TEST] Delete result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data?.success).toBe(true);

        // Verify file is gone
        const checkResult = await client.POST("/api/v1/sandbox/{id}/shell", {
          params: { path: { id: getSandboxId() } },
          body: { cmd: "test -f to-delete.txt && echo exists || echo gone" },
        });

        expect(checkResult.data?.data.stdout).toContain("gone");
      },
      TEST_TIMEOUT,
    );

    it(
      "should remove directory recursively",
      async () => {
        if (await skipIfNoSandbox("remove directory recursively")) return;

        console.log("[TEST] Creating nested directory structure...");
        await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: { path: { id: getSandboxId() } },
          body: { path: "testdir/sub1/file1.txt", content: "file1" },
        });
        await client.POST("/api/v1/sandbox/{id}/fs/write", {
          params: { path: { id: getSandboxId() } },
          body: { path: "testdir/sub2/file2.txt", content: "file2" },
        });

        console.log("[TEST] Deleting directory...");
        const { data, error } = await client.DELETE("/api/v1/sandbox/{id}/fs", {
          params: {
            path: {
              id: getSandboxId(),
            },
            query: {
              path: "testdir",
            },
          },
        });

        console.log("[TEST] Delete dir result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data?.success).toBe(true);

        // Verify directory is gone
        const checkResult = await client.POST("/api/v1/sandbox/{id}/shell", {
          params: { path: { id: getSandboxId() } },
          body: { cmd: "test -d testdir && echo exists || echo gone" },
        });

        expect(checkResult.data?.data.stdout).toContain("gone");
      },
      TEST_TIMEOUT,
    );
  });

  describe("Advanced Code Execution", () => {
    it(
      "should run Python with math operations",
      async () => {
        if (await skipIfNoSandbox("run Python with math operations")) return;

        console.log("[TEST] Running Python math operations...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            language: "python",
            code: `
import math

print(f"sqrt(16) = {math.sqrt(16)}")
print(f"pow(2, 8) = {math.pow(2, 8)}")
print(f"pi = {math.pi:.2f}")

squares = [x**2 for x in range(1, 6)]
print(f"squares: {squares}")
`,
          },
        });

        console.log("[TEST] Python math result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data?.data.stdout).toContain("sqrt(16) = 4");
        expect(data?.data.stdout).toContain("pow(2, 8) = 256");
        expect(data?.data.stdout).toContain("pi = 3.14");
        expect(data?.data.stdout).toContain("squares: [1, 4, 9, 16, 25]");
        expect(data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "should run TypeScript with async/await",
      async () => {
        if (await skipIfNoSandbox("run TypeScript with async/await")) return;

        console.log("[TEST] Running TypeScript async operations...");
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
          body: {
            language: "typescript",
            timeoutMs: 30000, // 30 seconds for first-time tsx download
            code: `
async function delay(ms: number): Promise<string> {
  return new Promise(resolve => {
    setTimeout(() => resolve("done"), ms);
  });
}

async function main() {
  console.log("start async operation");
  const result = await delay(100);
  console.log("async result:", result);
  
  const results = await Promise.all([
    Promise.resolve("a"),
    Promise.resolve("b"),
    Promise.resolve("c")
  ]);
  console.log("parallel results:", results.join(","));
}

main().catch(console.error);
`,
          },
        });

        console.log("[TEST] TypeScript async result:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data?.data.stdout).toContain("start async operation");
        expect(data?.data.stdout).toContain("async result: done");
        expect(data?.data.stdout).toContain("parallel results: a,b,c");
        expect(data?.data.exitCode).toBe(0);
      },
      TEST_TIMEOUT,
    );
  });

  describe("Sandbox Cleanup", () => {
    it(
      "should stop a sandbox",
      async () => {
        if (await skipIfNoSandbox("stop a sandbox")) return;

        console.log("[TEST] Stopping sandbox:", testSandboxId);
        const { data, error } = await client.POST("/api/v1/sandbox/{id}/stop", {
          params: {
            path: {
              id: getSandboxId(),
            },
          },
        });

        console.log("[TEST] Stop response:", JSON.stringify(data, null, 2));
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(data?.success).toBe(true);
        expect(data?.data.stopped).toBe(true);
      },
      TEST_TIMEOUT,
    );
  });
});
