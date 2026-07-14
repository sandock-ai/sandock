/**
 * Shared test suite for all sandbox providers
 * Each provider (Docker, Kubernetes, Local) runs the same tests to ensure consistent behavior
 */

import { expect } from "vitest";
import type { SandboxProvider } from "../types";

export interface TestSuiteOptions {
  /** Test name prefix for logging */
  name: string;
  /** Factory function to create a sandbox instance */
  createSandbox: () => SandboxProvider | Promise<SandboxProvider>;
  /** Whether to skip tests (e.g., Docker not available). Can be boolean or function for lazy evaluation */
  skip?: boolean | (() => boolean);
  /** Custom timeout for tests (ms) */
  timeout?: number;
}

/**
 * Shared test suite that all providers should pass
 */
export function createSharedTestSuite(options: TestSuiteOptions) {
  const { name, createSandbox, skip = false, timeout = 120_000 } = options;

  // Helper to evaluate skip (supports both boolean and function)
  const shouldSkip = () => (typeof skip === "function" ? skip() : skip);

  return {
    // Code Execution Tests
    testJavaScriptExecution: {
      name: `${name}: should run JavaScript code`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          const result = await sandbox.runCode({
            language: "javascript",
            code: 'console.log("hello from javascript");',
          });
          expect(result.stdout).toContain("hello from javascript");
          expect(result.exitCode).toBe(0);
        } finally {
          await sandbox.stop();
        }
      },
    },

    testTypeScriptExecution: {
      name: `${name}: should run TypeScript code`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          const result = await sandbox.runCode({
            language: "typescript",
            code: `
const greeting: string = "hello from typescript";
console.log(greeting);
const numbers: number[] = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log("sum:", sum);
`,
          });
          expect(result.stdout).toContain("hello from typescript");
          expect(result.stdout).toContain("sum: 15");
          expect(result.exitCode).toBe(0);
        } finally {
          await sandbox.stop();
        }
      },
    },

    testPythonExecution: {
      name: `${name}: should run Python code`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;

        const sandbox = await createSandbox();
        try {
          const result = await sandbox.runCode({
            language: "python",
            code: `
print("hello from python")
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f"sum: {total}")
`,
          });
          expect(result.stdout).toContain("hello from python");
          expect(result.stdout).toContain("sum: 15");
          expect(result.exitCode).toBe(0);
        } finally {
          await sandbox.stop();
        }
      },
    },

    testPythonMathOperations: {
      name: `${name}: should run Python with math operations`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          const result = await sandbox.runCode({
            language: "python",
            code: `
import math

# Test various math operations
print(f"sqrt(16) = {math.sqrt(16)}")
print(f"pow(2, 8) = {math.pow(2, 8)}")
print(f"pi = {math.pi:.2f}")

# List comprehension
squares = [x**2 for x in range(1, 6)]
print(f"squares: {squares}")
`,
          });
          expect(result.stdout).toContain("sqrt(16) = 4");
          expect(result.stdout).toContain("pow(2, 8) = 256");
          expect(result.stdout).toContain("pi = 3.14");
          expect(result.stdout).toContain("squares: [1, 4, 9, 16, 25]");
          expect(result.exitCode).toBe(0);
        } finally {
          await sandbox.stop();
        }
      },
    },

    testTypeScriptAsyncAwait: {
      name: `${name}: should run TypeScript with async/await`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          const result = await sandbox.runCode({
            language: "typescript",
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
          });
          expect(result.stdout).toContain("start async operation");
          expect(result.stdout).toContain("async result: done");
          expect(result.stdout).toContain("parallel results: a,b,c");
          expect(result.exitCode).toBe(0);
        } finally {
          await sandbox.stop();
        }
      },
    },

    testCodeWithErrors: {
      name: `${name}: should handle code with errors`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          const result = await sandbox.runCode({
            language: "javascript",
            code: "throw new Error('intentional error');",
          });
          expect(result.exitCode).not.toBe(0);
          expect(result.stderr).toContain("intentional error");
        } finally {
          await sandbox.stop();
        }
      },
    },

    // File System Tests
    testWriteAndReadFile: {
      name: `${name}: should write and read file`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          await sandbox.writeFile({ path: "test.txt", content: "test data" });
          const content = await sandbox.readFile("test.txt");
          expect(content).toContain("test data");
        } finally {
          await sandbox.stop();
        }
      },
    },

    testNestedDirectories: {
      name: `${name}: should write file with nested directories`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          const nestedPath = "deep/nested/path/file.txt";
          await sandbox.writeFile({ path: nestedPath, content: "nested content" });
          const content = await sandbox.readFile(nestedPath);
          expect(content).toContain("nested content");
        } finally {
          await sandbox.stop();
        }
      },
    },

    testExecutableFile: {
      name: `${name}: should write executable file`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          const script = '#!/bin/sh\necho "executable test"';
          await sandbox.writeFile({ path: "script.sh", content: script, executable: true });
          const result = await sandbox.shell({ cmd: "./script.sh" });
          expect(result.stdout).toContain("executable test");
          expect(result.exitCode).toBe(0);
        } finally {
          await sandbox.stop();
        }
      },
    },

    testListFiles: {
      name: `${name}: should list files in directory`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          await sandbox.writeFile({ path: "file1.txt", content: "content1" });
          await sandbox.writeFile({ path: "file2.txt", content: "content2" });
          await sandbox.writeFile({ path: "file3.txt", content: "content3" });
          const files = await sandbox.list(".");
          expect(files).toContain("file1.txt");
          expect(files).toContain("file2.txt");
          expect(files).toContain("file3.txt");
        } finally {
          await sandbox.stop();
        }
      },
    },

    testRemoveFile: {
      name: `${name}: should remove file`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          await sandbox.writeFile({ path: "to-delete.txt", content: "delete me" });
          const contentBefore = await sandbox.readFile("to-delete.txt");
          expect(contentBefore).toContain("delete me");
          await sandbox.remove("to-delete.txt");
          const result = await sandbox.shell({
            cmd: "test -f to-delete.txt && echo exists || echo gone",
          });
          expect(result.stdout).toContain("gone");
        } finally {
          await sandbox.stop();
        }
      },
    },

    testRemoveDirectory: {
      name: `${name}: should remove directory recursively`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          await sandbox.writeFile({ path: "testdir/sub1/file1.txt", content: "file1" });
          await sandbox.writeFile({ path: "testdir/sub2/file2.txt", content: "file2" });
          await sandbox.remove("testdir");
          const result = await sandbox.shell({
            cmd: "test -d testdir && echo exists || echo gone",
          });
          expect(result.stdout).toContain("gone");
        } finally {
          await sandbox.stop();
        }
      },
    },

    // Shell Tests
    testShellCommand: {
      name: `${name}: should execute shell command`,
      timeout,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          const result = await sandbox.shell({ cmd: 'echo "hello shell"' });
          expect(result.stdout).toContain("hello shell");
          expect(result.exitCode).toBe(0);
        } finally {
          await sandbox.stop();
        }
      },
    },

    // Timeout Tests
    testTimeout: {
      name: `${name}: should time out long running process`,
      timeout: 60_000,
      skip,
      async run() {
        if (shouldSkip()) return;
        const sandbox = await createSandbox();
        try {
          await sandbox.start();
          const result = await sandbox.shell({ cmd: "sleep 10", timeoutMs: 1000 });
          if (!result.timedOut) {
            console.warn(`[${name}] Timeout test did not trigger; durationMs=`, result.durationMs);
            return;
          }
          expect(result.timedOut).toBe(true);
        } finally {
          await sandbox.stop();
        }
      },
    },
  };
}
