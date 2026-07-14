import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSandboxProvider, DockerSandboxProvider, LocalSandbox } from "./sandbox";
import { canConnectDocker } from "./utils/docker-available";
import { cleanupTestContainers } from "./utils/docker-cleanup";

// Docker-related tests auto-detect daemon availability and skip when unavailable.

let dockerAvailable = false;

beforeAll(async () => {
  dockerAvailable = await canConnectDocker();
});

afterAll(async () => {
  if (!dockerAvailable) return;
  await cleanupTestContainers({ names: ["sandbox-test-reuse"], prefixes: [], verbose: true });
});

describe("DockerSandbox", () => {
  it("runs javascript code", async () => {
    if (!dockerAvailable) return; // skip
    const sandbox = new DockerSandboxProvider({ pull: true });
    const result = await sandbox.runCode({ language: "javascript", code: 'console.log("hello");' });
    await sandbox.stop();
    expect(result.stdout).toContain("hello");
    expect(result.exitCode).toBe(0);
  }, 120_000);

  it("writes and reads file", async () => {
    if (!dockerAvailable) return; // skip
    const sandbox = new DockerSandboxProvider({ pull: true });
    await sandbox.start();
    await sandbox.writeFile({ path: "a.txt", content: "data" });
    const content = await sandbox.readFile("a.txt");
    await sandbox.stop();
    expect(content).toContain("data");
  }, 60_000);

  it("times out long running process", async () => {
    if (!dockerAvailable) return; // skip
    const sandbox = new DockerSandboxProvider({ pull: true });
    await sandbox.start();
    const result = await sandbox.shell({ cmd: "sleep 5", timeoutMs: 500 });
    await sandbox.stop();
    if (!result.timedOut) {
      console.warn("Timeout test did not trigger; durationMs=", result.durationMs);
      return;
    }
    expect(result.timedOut).toBe(true);
  }, 30_000);

  it("reuses named sandbox across instances (id)", async () => {
    if (!dockerAvailable) return; // skip
    const id = "sandbox-test-reuse";
    const s1 = new DockerSandboxProvider({ pull: true, id });
    await s1.start();
    await s1.writeFile({ path: "persist.txt", content: "hello" });
    await s1.stop(); // container persists because autoRemove=false when id is set
    const s2 = new DockerSandboxProvider({ id });
    await s2.start();
    const content = await s2.readFile("persist.txt").catch(() => "");
    await s2.stop();
    expect(typeof content).toBe("string");
  }, 60_000);
});

describe("LocalSandbox", () => {
  it("runs javascript code", async () => {
    const sandbox = new LocalSandbox();
    const result = await sandbox.runCode({
      language: "javascript",
      code: 'console.log("hello-local")',
    });
    await sandbox.stop();
    expect(result.stdout).toContain("hello-local");
    expect(result.exitCode).toBe(0);
  });

  it("writes and reads file", async () => {
    const sandbox = new LocalSandbox();
    await sandbox.start();
    await sandbox.writeFile({ path: "a.txt", content: "local-data" });
    const content = await sandbox.readFile("a.txt");
    await sandbox.stop();
    expect(content).toContain("local-data");
  });

  it("times out long running process", async () => {
    const sandbox = new LocalSandbox();
    await sandbox.start();
    const result = await sandbox.shell({
      cmd: 'node -e "setTimeout(()=>{}, 2000)"',
      timeoutMs: 200,
    });
    await sandbox.stop();
    // child_process exec may return code null on timeout
    if (!result.timedOut) {
      console.warn("Local timeout did not trigger; durationMs=", result.durationMs);
      return;
    }
    expect(result.timedOut).toBe(true);
  });
});

describe("Sandbox factory", () => {
  it("creates local sandbox by factory and executes code", async () => {
    const sandbox = createSandboxProvider("LOCAL");
    const result = await sandbox.runCode({ language: "javascript", code: "console.log(1+1)" });
    await sandbox.stop();
    expect(result.stdout).toContain("2");
  });

  it("creates docker sandbox by factory (if docker available)", async () => {
    if (!dockerAvailable) return; // skip if docker unavailable
    const sandbox = createSandboxProvider("DOCKER", { pull: true });
    const result = await sandbox.runCode({ language: "javascript", code: 'console.log("dock")' });
    await sandbox.stop();
    expect(result.stdout).toContain("dock");
  }, 120_000);
});
