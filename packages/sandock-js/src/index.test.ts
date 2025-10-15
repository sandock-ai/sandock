import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSandockClient } from "./index";

const DEFAULT_BASE_URL = process.env.SANDOCK_API_URL || "http://localhost:3030";
const TEST_TIMEOUT = 60_000; // 60 seconds for most tests
const LONG_TEST_TIMEOUT = 180_000; // 3 minutes for longer operations

// Universal test token for localhost testing
const TEST_TOKEN = "sandock_test_token_local_dev_only";

// Check if the server is available before running tests
let serverAvailable = false;
let testSandboxId: string | null = null;

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
    const { data, error } = await client.GET("/api/meta");

    if (data && data.success) {
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
      await client.POST("/api/sandbox/{id}/stop", {
        params: { path: { id: testSandboxId! } },
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
    const { data, error } = await client.POST("/api/sandbox", {
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
    const startResult = await client.POST("/api/sandbox/{id}/start", {
      params: { path: { id: testSandboxId! } },
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
      fetch: customFetch as any,
    });
    expect(client).toBeDefined();
  });
});

describe("Sandock API Integration Tests", () => {
  describe("Meta API", () => {
    it(
      "should get server meta information",
      async () => {
        if (skipIfNoServer("get server meta information")) return;

        const { data, error } = await client.GET("/api/meta");

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
        const { data, error } = await client.POST("/api/sandbox", {
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
      "should list sandboxes",
      async () => {
        if (skipIfNoServer("list sandboxes")) return;

        const { data, error } = await client.GET("/api/sandbox", {
          params: {
            query: {
              spaceId: "test-space-sdk",
            },
          },
        });

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
        const { data, error } = await client.POST("/api/sandbox/{id}/start", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/code", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/code", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/code", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/code", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/code", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/shell", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/shell", {
          params: {
            path: {
              id: testSandboxId!,
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
        const writeResult = await client.POST("/api/sandbox/{id}/fs/write", {
          params: {
            path: {
              id: testSandboxId!,
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
        const readResult = await client.GET("/api/sandbox/{id}/fs/read", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/fs/write", {
          params: {
            path: {
              id: testSandboxId!,
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

        const readResult = await client.GET("/api/sandbox/{id}/fs/read", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/fs/write", {
          params: {
            path: {
              id: testSandboxId!,
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
        const execResult = await client.POST("/api/sandbox/{id}/shell", {
          params: {
            path: {
              id: testSandboxId!,
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
        await client.POST("/api/sandbox/{id}/fs/write", {
          params: { path: { id: testSandboxId! } },
          body: { path: "file1.txt", content: "content1" },
        });
        await client.POST("/api/sandbox/{id}/fs/write", {
          params: { path: { id: testSandboxId! } },
          body: { path: "file2.txt", content: "content2" },
        });

        console.log("[TEST] Listing directory...");
        const { data, error } = await client.GET("/api/sandbox/{id}/fs/list", {
          params: {
            path: {
              id: testSandboxId!,
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
        await client.POST("/api/sandbox/{id}/fs/write", {
          params: { path: { id: testSandboxId! } },
          body: { path: "to-delete.txt", content: "delete me" },
        });

        console.log("[TEST] Deleting file...");
        const { data, error } = await client.DELETE("/api/sandbox/{id}/fs", {
          params: {
            path: {
              id: testSandboxId!,
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
        const checkResult = await client.POST("/api/sandbox/{id}/shell", {
          params: { path: { id: testSandboxId! } },
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
        await client.POST("/api/sandbox/{id}/fs/write", {
          params: { path: { id: testSandboxId! } },
          body: { path: "testdir/sub1/file1.txt", content: "file1" },
        });
        await client.POST("/api/sandbox/{id}/fs/write", {
          params: { path: { id: testSandboxId! } },
          body: { path: "testdir/sub2/file2.txt", content: "file2" },
        });

        console.log("[TEST] Deleting directory...");
        const { data, error } = await client.DELETE("/api/sandbox/{id}/fs", {
          params: {
            path: {
              id: testSandboxId!,
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
        const checkResult = await client.POST("/api/sandbox/{id}/shell", {
          params: { path: { id: testSandboxId! } },
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
        const { data, error } = await client.POST("/api/sandbox/{id}/code", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/code", {
          params: {
            path: {
              id: testSandboxId!,
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
        const { data, error } = await client.POST("/api/sandbox/{id}/stop", {
          params: {
            path: {
              id: testSandboxId!,
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
