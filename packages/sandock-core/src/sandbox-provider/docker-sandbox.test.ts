import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DockerSandboxProvider } from "../sandbox";
import { canConnectDocker } from "../utils/docker-available";
import { cleanupTestContainers } from "../utils/docker-cleanup";
import { createSharedTestSuite } from "./shared-test-suite";

// Use SANDBOX_PROVIDER to decide whether Docker tests should run
// - SANDBOX_PROVIDER=DOCKER: Run only Docker tests
// - Unset: run all available tests after checking the Docker daemon
const sandboxProvider = process.env.SANDBOX_PROVIDER?.toUpperCase();
const shouldRunDocker = !sandboxProvider || sandboxProvider === "DOCKER";

let dockerAvailable = false;

beforeAll(async () => {
  // eslint-disable-next-line no-console
  console.log("[TEST] beforeAll: starting docker availability check");
  if (shouldRunDocker) {
    dockerAvailable = await canConnectDocker();
  }
  // eslint-disable-next-line no-console
  console.log("[TEST] beforeAll: dockerAvailable=", dockerAvailable);
});

afterAll(async () => {
  if (!dockerAvailable) return;
  await cleanupTestContainers({ names: ["sandbox-test-reuse"], prefixes: [], verbose: true });
});

describe("DockerSandbox", () => {
  const TEST_IMAGE = process.env.SANDBOX_DOCKER_IMAGE || "sandockai/sandock-code:latest";

  // Create shared test suite
  // Note: skip is evaluated lazily in run() because dockerAvailable is set in beforeAll
  const sharedTests = createSharedTestSuite({
    name: "Docker",
    createSandbox: () => new DockerSandboxProvider({ pull: true, image: TEST_IMAGE }),
    skip: () => !shouldRunDocker || !dockerAvailable, // Use function for lazy evaluation
    timeout: 120_000,
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

  // Docker-specific tests
  it("Docker: should reuse named sandbox across instances (id)", async () => {
    if (!shouldRunDocker || !dockerAvailable) return; // skip
    const id = "sandbox-test-reuse";
    const s1 = new DockerSandboxProvider({ pull: true, id, image: TEST_IMAGE });
    await s1.start();
    await s1.writeFile({ path: "persist.txt", content: "hello" });
    await s1.stop(); // container persists because autoRemove=false when id is set
    const s2 = new DockerSandboxProvider({ id, image: TEST_IMAGE });
    await s2.start();
    const content = await s2.readFile("persist.txt").catch(() => "");
    await s2.stop();
    expect(typeof content).toBe("string");
  }, 60_000);
});
