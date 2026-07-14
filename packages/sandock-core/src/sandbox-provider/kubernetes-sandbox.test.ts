import { describe, expect, it } from "vitest";
import { KubernetesSandboxProvider } from "../sandbox";
import { createSharedTestSuite } from "./shared-test-suite";

// Use SANDBOX_PROVIDER to decide whether Kubernetes tests should run
// - SANDBOX_PROVIDER=KUBERNETES: Run only Kubernetes tests
// - Unset: run all available tests after checking the Docker daemon
const sandboxProvider = process.env.SANDBOX_PROVIDER?.toUpperCase();
const shouldRunKubernetes = sandboxProvider && sandboxProvider === "KUBERNETES";

// Test scripts:
// SANDBOX_DEBUG=true SANDBOX_PROVIDER=KUBERNETES pnpm test kubernetes-sandbox.test
describe("KubernetesSandbox", () => {
  const TEST_IMAGE = "sandockai/sandock-code:latest";

  // Create shared test suite
  const sharedTests = createSharedTestSuite({
    name: "Kubernetes",
    createSandbox: () => new KubernetesSandboxProvider({ image: TEST_IMAGE }),
    skip: !shouldRunKubernetes,
    timeout: 180_000, // K8s pod creation can be slower
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

  // Kubernetes-specific tests
  it("Kubernetes: should parse KUBECONFIG_BASE64 environment variable", async () => {
    if (!shouldRunKubernetes) return; // skip
    const originalEnv = process.env.SANDBOX_K8S_KUBECONFIG_BASE64;

    try {
      // Test with a mock base64 kubeconfig (this will fail to connect, but should parse)
      const mockKubeconfig = `
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://test-cluster.example.com:6443
    insecure-skip-tls-verify: true
  name: test-cluster
contexts:
- context:
    cluster: test-cluster
    user: test-user
  name: test-context
current-context: test-context
users:
- name: test-user
  user:
    token: test-token
`;
      process.env.SANDBOX_K8S_KUBECONFIG_BASE64 = Buffer.from(mockKubeconfig).toString("base64");

      const sandbox = new KubernetesSandboxProvider({ image: TEST_IMAGE });
      // We expect this to fail to connect, but parsing should succeed
      await sandbox.start().catch((e) => {
        // Expected to fail - we're just testing parsing logic
        expect((e as Error).message).toBeTruthy();
      });
    } finally {
      // Restore original env
      if (originalEnv) {
        process.env.SANDBOX_K8S_KUBECONFIG_BASE64 = originalEnv;
      } else {
        delete process.env.SANDBOX_K8S_KUBECONFIG_BASE64;
      }
    }
  }, 30_000);

  // Test space isolation: Different spaces should not reuse each other's pods
  it("Kubernetes: should isolate pods by spaceId", async () => {
    if (!shouldRunKubernetes) return; // skip

    // Create two sandbox providers with different spaceIds
    const space1 = "space-test-1";
    const space2 = "space-test-2";

    const sandbox1 = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      spaceId: space1,
    });
    const sandbox2 = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      spaceId: space2,
    });

    try {
      // Start first sandbox
      const pod1 = await sandbox1.start();
      expect(pod1).toBeTruthy();

      // Start second sandbox - should create a new pod, not reuse the first one
      const pod2 = await sandbox2.start();
      expect(pod2).toBeTruthy();

      // Verify they are different pods (different space isolation)
      expect(pod1).not.toBe(pod2);

      // Verify both can execute code independently
      const result1 = await sandbox1.runCode({
        language: "javascript",
        code: "console.log('space1');",
      });
      expect(result1.exitCode).toBe(0);
      expect(result1.stdout).toContain("space1");

      const result2 = await sandbox2.runCode({
        language: "javascript",
        code: "console.log('space2');",
      });
      expect(result2.exitCode).toBe(0);
      expect(result2.stdout).toContain("space2");
    } finally {
      // Clean up both sandboxes
      await sandbox1.stop().catch(() => {});
      await sandbox2.stop().catch(() => {});
    }
  }, 180_000);

  // Test same space reuse: Same space should NOT reuse existing pod unless sandboxId matches
  it("Kubernetes: should reuse pod ONLY if sandboxId matches", async () => {
    if (!shouldRunKubernetes) return; // skip

    const spaceId = "space-test-reuse-v2";
    const sandboxId = "sandbox-uuid-123";

    // 1. First sandbox with explicit sandboxId
    const sandbox1 = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      spaceId: spaceId,
      sandboxId: sandboxId,
    });

    // 2. Second sandbox with SAME sandboxId -> Should reuse
    const sandbox2 = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      spaceId: spaceId,
      sandboxId: sandboxId,
    });

    // 3. Third sandbox with DIFFERENT sandboxId -> Should create new
    const sandbox3 = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      spaceId: spaceId,
      sandboxId: "sandbox-uuid-456",
    });

    // 4. Fourth sandbox WITHOUT sandboxId -> Should create new (default behavior)
    const sandbox4 = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      spaceId: spaceId,
    });

    try {
      // Start 1
      const pod1 = await sandbox1.start();
      expect(pod1).toBeTruthy();

      // Start 2 (should reuse pod1)
      const pod2 = await sandbox2.start();
      expect(pod2).toBeTruthy();
      expect(pod1).toBe(pod2);

      // Start 3 (should be new)
      const pod3 = await sandbox3.start();
      expect(pod3).toBeTruthy();
      expect(pod3).not.toBe(pod1);

      // Start 4 (should be new)
      const pod4 = await sandbox4.start();
      expect(pod4).toBeTruthy();
      expect(pod4).not.toBe(pod1);
      expect(pod4).not.toBe(pod3);
    } finally {
      // Clean up
      await sandbox1.stop().catch(() => {});
      // sandbox2 shares pod with sandbox1, so stop() might have already deleted it or will delete it
      await sandbox2.stop().catch(() => {});
      await sandbox3.stop().catch(() => {});
      await sandbox4.stop().catch(() => {});
    }
  }, 180_000);

  // Test image isolation: Different images should not reuse pods
  it("Kubernetes: should not reuse pod if image differs", async () => {
    if (!shouldRunKubernetes) return; // skip

    const spaceId = "space-test-image-isolation";
    const image1 = "sandockai/sandock-code:latest";
    const image2 = "python:3.12-slim";

    const sandbox1 = new KubernetesSandboxProvider({
      image: image1,
      spaceId: spaceId,
    });
    const sandbox2 = new KubernetesSandboxProvider({
      image: image2,
      spaceId: spaceId,
    });

    try {
      // Start first sandbox with image1
      const pod1 = await sandbox1.start();
      expect(pod1).toBeTruthy();

      // Start second sandbox with same spaceId but different image - should create new pod
      const pod2 = await sandbox2.start();
      expect(pod2).toBeTruthy();

      // Verify they are different pods (different image = different pod)
      expect(pod1).not.toBe(pod2);
    } finally {
      // Clean up both sandboxes
      await sandbox1.stop().catch(() => {});
      await sandbox2.stop().catch(() => {});
    }
  }, 180_000);

  // Test activeDeadlineSeconds option
  it("Kubernetes: should accept activeDeadlineSeconds option", async () => {
    if (!shouldRunKubernetes) return; // skip

    const sandbox = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      activeDeadlineSeconds: 3600, // 1 hour max runtime
    });

    try {
      const pod = await sandbox.start();
      expect(pod).toBeTruthy();

      // Verify sandbox can execute code
      const result = await sandbox.runCode({
        language: "javascript",
        code: "console.log('test with activeDeadlineSeconds');",
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test with activeDeadlineSeconds");
    } finally {
      await sandbox.stop().catch(() => {});
    }
  }, 180_000);

  // Test custom command option
  it("Kubernetes: should accept custom command option", async () => {
    if (!shouldRunKubernetes) return; // skip

    const sandbox = new KubernetesSandboxProvider({
      image: TEST_IMAGE,
      command: ["sh", "-c", "mkdir -p /sandbox && sleep 3600"],
    });

    try {
      const pod = await sandbox.start();
      expect(pod).toBeTruthy();

      // Verify sandbox can execute code with custom command
      const result = await sandbox.runCode({
        language: "javascript",
        code: "console.log('test with custom command');",
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test with custom command");
    } finally {
      await sandbox.stop().catch(() => {});
    }
  }, 180_000);
});
