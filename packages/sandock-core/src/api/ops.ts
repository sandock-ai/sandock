import type { CreateSandboxInput } from "sandock-contract/types";
import { generateUniqueRandomSandboxName } from "../random-name";
import type { SandboxManager } from "../sandbox-manager";
import type { SandboxActor } from "./context";

/**
 * Transport-neutral sandbox operations — the shared LOGIC behind the base contract's procedures.
 * Both apps/sandock and apps/sandock-cloud wrap these in their own thin oRPC handlers (each against
 * its own contract + auth), so the behavior is identical without threading a single generic
 * implementer across two contracts. Every op returns the raw VO `data`; callers wrap it in the
 * response envelope.
 */

export type CreateSandboxFn = (
  input: CreateSandboxInput,
  actor: SandboxActor,
) => Promise<{ id: string }>;

/** Default create (no tenant policy): auto-title + manager.create. sandock overrides with quota. */
export const defaultCreateSandbox =
  (manager: SandboxManager): CreateSandboxFn =>
  async (input, actor) => {
    const sb = await manager.create({
      userId: actor.userId,
      spaceId: actor.spaceId ?? null,
      actorUserId: actor.userId,
      title: input.title ?? generateUniqueRandomSandboxName([]),
      image: input.image,
      cpuLimit: input.cpuShares,
      memoryLimit: input.memoryLimitMb,
      activeDeadlineSeconds: input.activeDeadlineSeconds,
      command: input.command,
      env: input.env,
      volumes: input.volumes,
      autoDeleteInterval: input.autoDeleteInterval,
      clusterId: input.clusterId,
    });
    return { id: sb.id };
  };

export const opList = async (manager: SandboxManager, actor: SandboxActor) => {
  const rows = await manager.list({ spaceId: actor.spaceId });
  return { items: rows.map((s) => ({ id: s.id, status: s.status })) };
};

export const opStart = async (manager: SandboxManager, id: string) => {
  await manager.getProvider(id); // starts if needed
  return { id, started: true };
};

export const opStop = async (manager: SandboxManager, id: string) => {
  await manager.stop(id);
  return { id, stopped: true };
};

export const opPause = async (manager: SandboxManager, id: string) => {
  await manager.pause(id);
  return { id, status: "PAUSED", paused: true };
};

export const opResume = async (manager: SandboxManager, id: string) => {
  await manager.resume(id);
  return { id, status: "RUNNING", resumed: true };
};

export const opDelete = async (manager: SandboxManager, id: string) => {
  await manager.delete(id);
  return { id, deleted: true };
};

export const opRunCode = async (
  manager: SandboxManager,
  id: string,
  input: {
    language: "javascript" | "typescript" | "python";
    code: string;
    timeoutMs?: number;
    input?: string;
    env?: Record<string, string>;
  },
) => {
  const provider = await manager.getProvider(id);
  return provider.runCode({
    language: input.language,
    code: input.code,
    timeoutMs: input.timeoutMs,
    input: input.input,
    env: input.env,
  });
};

export const opShell = async (
  manager: SandboxManager,
  id: string,
  input: {
    cmd: string | string[];
    timeoutMs?: number;
    workdir?: string;
    env?: Record<string, string>;
    input?: string;
  },
) => {
  const provider = await manager.getProvider(id);
  return provider.shell({
    cmd: input.cmd,
    timeoutMs: input.timeoutMs,
    workdir: input.workdir,
    env: input.env,
    input: input.input,
  });
};

export const opWriteFile = async (
  manager: SandboxManager,
  id: string,
  input: { path: string; content: string; executable?: boolean },
) => {
  const provider = await manager.getProvider(id);
  await provider.writeFile({
    path: input.path,
    content: input.content,
    executable: input.executable,
  });
  return true;
};

export const opReadFile = async (manager: SandboxManager, id: string, path: string) => {
  const provider = await manager.getProvider(id);
  const content = await provider.readFile(path);
  return { path, content };
};

export const opListFiles = async (manager: SandboxManager, id: string, path?: string) => {
  const provider = await manager.getProvider(id);
  const entries = await provider.list(path);
  return { path: path ?? ".", entries };
};

export const opRemoveFile = async (manager: SandboxManager, id: string, path: string) => {
  const provider = await manager.getProvider(id);
  await provider.remove(path);
  return true;
};
