// Polymorphic sandbox providers barrel export

// Legacy SandboxManager removed; use persistentSandboxManager instead.
export {
  type DockerSandboxOptions,
  DockerSandboxProvider,
} from "./sandbox-provider/docker";
export {
  type KubernetesSandboxOptions,
  KubernetesSandboxProvider,
} from "./sandbox-provider/kubernetes";
export {
  type LocalSandboxOptions,
  LocalSandboxProvider as LocalSandbox,
} from "./sandbox-provider/local";
export * from "./types";

import { type DockerSandboxOptions, DockerSandboxProvider } from "./sandbox-provider/docker";
import {
  type KubernetesSandboxOptions,
  KubernetesSandboxProvider,
} from "./sandbox-provider/kubernetes";
import { type LocalSandboxOptions, LocalSandboxProvider } from "./sandbox-provider/local";
import type { SandboxProviderKind as SandboxProviderEnum } from "./types";

// Factory helper to create a sandbox provider by name.
// Usage: const sandbox = createSandboxProvider('DOCKER', { pull: true })

export function createSandboxProvider(
  name: "DOCKER",
  options?: DockerSandboxOptions,
): DockerSandboxProvider;
export function createSandboxProvider(
  name: "LOCAL",
  options?: LocalSandboxOptions,
): LocalSandboxProvider;
export function createSandboxProvider(
  name: "KUBERNETES",
  options?: KubernetesSandboxOptions,
): KubernetesSandboxProvider;
export function createSandboxProvider(
  name: SandboxProviderEnum,
  options?: DockerSandboxOptions | LocalSandboxOptions | KubernetesSandboxOptions | undefined,
): DockerSandboxProvider | LocalSandboxProvider | KubernetesSandboxProvider {
  switch (name) {
    case "DOCKER":
      return new DockerSandboxProvider(options as DockerSandboxOptions);
    case "LOCAL":
      return new LocalSandboxProvider(options as LocalSandboxOptions);
    case "KUBERNETES":
      return new KubernetesSandboxProvider(options as KubernetesSandboxOptions);
    default:
      throw new Error(`Unsupported sandbox provider: ${name}`);
  }
}
