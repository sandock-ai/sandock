import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DockerSandboxProvider } from "./sandbox-provider/docker";
import { KubernetesSandboxProvider } from "./sandbox-provider/kubernetes";
import { LocalSandboxProvider } from "./sandbox-provider/local";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv }; // reset to baseline each test
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("DockerSandboxProvider resource metrics", () => {
  it("reports default cpu/mem", () => {
    const d = new DockerSandboxProvider();
    // default cpuShares=256 => 0.25 cores
    expect(d.cpu).toBeCloseTo(0.25, 3);
    // default mem 512 MiB
    expect(d.mem).toBe(512 * 1024 * 1024);
  });

  it("honors env SANDBOX_DOCKER_CPU and SANDBOX_DOCKER_MEMORY_MB", () => {
    process.env.SANDBOX_DOCKER_CPU = "1.5";
    process.env.SANDBOX_DOCKER_MEMORY_MB = "1024";
    const d = new DockerSandboxProvider();
    expect(d.cpu).toBeCloseTo(1.5, 3);
    expect(d.mem).toBe(1024 * 1024 * 1024);
  });

  it("honors explicit options over env", () => {
    process.env.SANDBOX_DOCKER_CPU = "2";
    const d = new DockerSandboxProvider({ cpuShares: 512, memoryLimitMb: 256 });
    expect(d.cpu).toBeCloseTo(0.5, 3); // 512/1024
    expect(d.mem).toBe(256 * 1024 * 1024);
  });
});

describe("KubernetesSandboxProvider resource metrics", () => {
  it("computes cpu from milli cores", () => {
    const k = new KubernetesSandboxProvider({ cpuLimit: "750m", memoryLimitMb: 1024 });
    expect(k.cpu).toBeCloseTo(0.75, 3);
    expect(k.mem).toBe(1024 * 1024 * 1024);
  });

  it("computes cpu from whole number cores", () => {
    const k = new KubernetesSandboxProvider({ cpuLimit: "2", memoryLimitMb: 256 });
    expect(k.cpu).toBe(2);
    expect(k.mem).toBe(256 * 1024 * 1024);
  });
});

describe("LocalSandboxProvider resource metrics", () => {
  it("uses env overrides for cpu/mem", () => {
    process.env.SANDBOX_LOCAL_CPU = "3";
    process.env.SANDBOX_LOCAL_MEM_MB = "2048";
    const l = new LocalSandboxProvider();
    expect(l.cpu).toBe(3);
    expect(l.mem).toBe(2048 * 1024 * 1024);
  });
});
