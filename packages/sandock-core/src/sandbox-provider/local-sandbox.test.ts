import { describe, expect, it } from "vitest";
import { createSandboxProvider, LocalSandbox } from "../sandbox";
import { createSharedTestSuite } from "./shared-test-suite";

// Local provider always runs (no conditional skip)
describe("LocalSandbox", () => {
  // Create shared test suite
  const sharedTests = createSharedTestSuite({
    name: "Local",
    createSandbox: () => new LocalSandbox(),
    skip: false,
    timeout: 30_000, // Local is faster than containers
  });

  // Code Execution Tests
  it(
    sharedTests.testJavaScriptExecution.name,
    async () => {
      await sharedTests.testJavaScriptExecution.run();
    },
    sharedTests.testJavaScriptExecution.timeout,
  );

  it(
    sharedTests.testTypeScriptExecution.name,
    async () => {
      await sharedTests.testTypeScriptExecution.run();
    },
    sharedTests.testTypeScriptExecution.timeout,
  );

  it(
    sharedTests.testPythonExecution.name,
    async () => {
      await sharedTests.testPythonExecution.run();
    },
    sharedTests.testPythonExecution.timeout,
  );

  it(
    sharedTests.testPythonMathOperations.name,
    async () => {
      await sharedTests.testPythonMathOperations.run();
    },
    sharedTests.testPythonMathOperations.timeout,
  );

  it(
    sharedTests.testTypeScriptAsyncAwait.name,
    async () => {
      await sharedTests.testTypeScriptAsyncAwait.run();
    },
    sharedTests.testTypeScriptAsyncAwait.timeout,
  );

  it(
    sharedTests.testCodeWithErrors.name,
    async () => {
      await sharedTests.testCodeWithErrors.run();
    },
    sharedTests.testCodeWithErrors.timeout,
  );

  // File System Tests
  it(
    sharedTests.testWriteAndReadFile.name,
    async () => {
      await sharedTests.testWriteAndReadFile.run();
    },
    sharedTests.testWriteAndReadFile.timeout,
  );

  it(
    sharedTests.testNestedDirectories.name,
    async () => {
      await sharedTests.testNestedDirectories.run();
    },
    sharedTests.testNestedDirectories.timeout,
  );

  it(
    sharedTests.testExecutableFile.name,
    async () => {
      await sharedTests.testExecutableFile.run();
    },
    sharedTests.testExecutableFile.timeout,
  );

  it(
    sharedTests.testListFiles.name,
    async () => {
      await sharedTests.testListFiles.run();
    },
    sharedTests.testListFiles.timeout,
  );

  it(
    sharedTests.testRemoveFile.name,
    async () => {
      await sharedTests.testRemoveFile.run();
    },
    sharedTests.testRemoveFile.timeout,
  );

  it(
    sharedTests.testRemoveDirectory.name,
    async () => {
      await sharedTests.testRemoveDirectory.run();
    },
    sharedTests.testRemoveDirectory.timeout,
  );

  // Shell Tests
  it(
    sharedTests.testShellCommand.name,
    async () => {
      await sharedTests.testShellCommand.run();
    },
    sharedTests.testShellCommand.timeout,
  );

  // Timeout Tests
  it(
    sharedTests.testTimeout.name,
    async () => {
      await sharedTests.testTimeout.run();
    },
    sharedTests.testTimeout.timeout,
  );
});

describe("Sandbox factory", () => {
  it("creates local sandbox by factory and executes code", async () => {
    const sandbox = createSandboxProvider("LOCAL");
    const result = await sandbox.runCode({ language: "javascript", code: "console.log(1+1)" });
    await sandbox.stop();
    expect(result.stdout).toContain("2");
  });

  // it("creates docker sandbox by factory (if docker available)", async () => {
  //   const dockerAvailable = await canConnectDocker();
  //   if (!dockerAvailable) return; // skip if docker unavailable
  //   const sandbox = createSandboxProvider("DOCKER", { pull: true });
  //   const result = await sandbox.runCode({
  //     language: "javascript",
  //     code: 'console.log("dock")',
  //   });
  //   await sandbox.stop();
  //   expect(result.stdout).toContain("dock");
  // }, 120_000);

  // it("creates kubernetes sandbox by factory (if K8s available)", async () => {
  //   try {
  //     const sandbox = createSandboxProvider("KUBERNETES");
  //     const result = await sandbox.runCode({
  //       language: "javascript",
  //       code: 'console.log("k8s")',
  //     });
  //     await sandbox.stop();
  //     expect(result.stdout).toContain("k8s");
  //   } catch (e) {
  //     console.warn("Skipping K8s factory test - cluster not available:", (e as Error).message);
  //     return;
  //   }
  // }, 180_000);
});
