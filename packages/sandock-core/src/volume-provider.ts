import type { SandboxProviderKind } from "./types";

/** Only volumeId, mountPath, subpath are exposed to CLI clients; storageType, mode,
 * nodeAffinityTarget are derived from the volume record server-side. */
export interface VolumeMountInput {
  volumeId: string;
  mountPath: string;
  subpath?: string;
}

/** Structural subset of a host's volume record — only the fields SandboxManager reads. */
export interface VolumeInfo {
  id: string;
  storageType?: string | null;
  pvcName?: string | null;
  boundNode?: string | null;
}

export interface ProviderVolumeMount {
  source: string;
  target: string;
  readOnly?: boolean;
}

/**
 * Injected by the host app to support persistent volume mounts on sandbox creation.
 * `apps/sandock-cloud` injects a real implementation backed by its `volumes` table (EBS/S3/K8s
 * PVC-aware, spaceId-scoped). `apps/sandock` (single-machine, no persistent volume
 * concept yet) omits this — SandboxManager falls back to `noopVolumeMountProvider`, which
 * rejects any mount request and reports zero mounts.
 */
export interface VolumeMountProvider {
  validateMounts(
    spaceId: string | null,
    mounts: VolumeMountInput[],
  ): Promise<{ valid: boolean; errors: string[] }>;
  getRaw(volumeId: string): Promise<VolumeInfo>;
  recordMounts(sandboxId: string, mounts: VolumeMountInput[], dbClient?: unknown): Promise<void>;
  getMounts(sandboxId: string): Promise<VolumeMountInput[]>;
  updateBoundNode(volumeId: string, boundNode: string | null): Promise<void>;
  generateProviderVolumeMount(
    provider: SandboxProviderKind,
    spaceId: string | null,
    volumeId: string,
    mountPath: string,
    subpath?: string,
  ): ProviderVolumeMount;
}

export const noopVolumeMountProvider: VolumeMountProvider = {
  async validateMounts(_spaceId, mounts) {
    if (mounts.length === 0) return { valid: true, errors: [] };
    return { valid: false, errors: ["Volume mounts are not supported in this deployment"] };
  },
  async getRaw() {
    throw new Error("Volume mounts are not supported in this deployment");
  },
  async recordMounts() {},
  async getMounts() {
    return [];
  },
  async updateBoundNode() {},
  generateProviderVolumeMount() {
    throw new Error("Volume mounts are not supported in this deployment");
  },
};
