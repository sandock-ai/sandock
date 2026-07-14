import { and, eq, inArray, isNull } from "drizzle-orm";
import { generateNanoID } from "openlib/nanoid";
import type { RedisClientType } from "redis";
import type { Database } from "./db";
import { type Sandbox, type SandboxProvider, type SandboxStatus, sandboxes } from "./db/schema";
import { RedisLockProvider } from "./lock-provider";
import { closeRunSegment, recordStartSuccess, recordStatusEvent } from "./metrics";
import { createSandboxProvider } from "./sandbox";
import type { SandboxProvider as ProviderInterface } from "./types";
import {
  noopVolumeMountProvider,
  type VolumeMountInput,
  type VolumeMountProvider,
} from "./volume-provider";

type SandboxDbClient = Pick<Database, "insert" | "update">;

// ---------------------------------------------------------------------------
// Provider cache: avoid re-instantiating provider + K8s client on every call
// ---------------------------------------------------------------------------
interface CachedProvider {
  provider: ProviderInterface;
  /** DB status at cache time (invalidate if status changed) */
  dbStatus: SandboxStatus;
  createdAt: number;
}
/** TTL for cached providers (2 minutes) */
const PROVIDER_CACHE_TTL_MS = 2 * 60 * 1000;
/** Max entries before oldest entries are evicted */
const PROVIDER_CACHE_MAX_SIZE = 200;

/** Input when creating a sandbox */
export interface CreateSandboxInput {
  /** User ID who owns this sandbox (required for subPath isolation) */
  userId: string;
  /** Optional space id for multi-user collaboration. If null, sandbox belongs to user directly. */
  spaceId?: string | null;
  /** Optional actor user (for future multi-member auditing). */
  actorUserId?: string;
  title: string;
  forceProvider?: SandboxProvider;
  image?: string;
  cpuLimit?: number;
  memoryLimit?: number;
  activeDeadlineSeconds?: number;
  command?: string[];
  metadata?: Record<string, unknown>;
  /** Volume mounts for the sandbox */
  volumes?: VolumeMountInput[];
  /** Environment variables to set in the container */
  env?: Record<string, string>;
  /** Target K8S cluster ID (for multi-cluster routing) */
  clusterId?: string;
  /**
   * Auto-delete interval in minutes for stopped sandboxes.
   * -1: disable auto-delete; 0: delete immediately on stop; positive number: minutes.
   * Default (undefined/null): 1440 minutes (1 day).
   */
  autoDeleteInterval?: number;
}

export interface ReserveSandboxInput extends CreateSandboxInput {
  dbClient?: SandboxDbClient;
}

export interface PersistentSandboxManagerOptions {
  /** Base directory for local provider deterministic folders (optional) */
  localBaseDir?: string;
  /** Persistent volume mount support. Omit for deployments with no volume concept
   * (e.g. apps/sandock) — falls back to a no-op provider that rejects mounts. */
  volumeProvider?: VolumeMountProvider;
  /** Distributed lock support via Redis. Omit for single-process deployments — `getProvider()`
   * falls back to in-process-only coordination (no cross-instance locking). */
  getRedisClient?: () => Promise<RedisClientType>;
}

// Provider selection now mapped via env to Persistent manager provider enum names
const providerName: SandboxProvider =
  (process.env.SANDBOX_PROVIDER?.toUpperCase() as SandboxProvider) || "DOCKER";

/**
 * A DB-backed sandbox manager with L1 provider cache – each call fetches DB state
 * but reuses a cached provider instance if the sandbox status hasn't changed,
 * saving the cost of re-instantiating the K8s client and pod lookup.
 */
export class SandboxManager {
  private db: Database;
  private localBaseDir?: string;
  private volumeProvider: VolumeMountProvider;
  private getRedisClient?: () => Promise<RedisClientType>;
  /** L1 provider cache keyed by sandbox ID */
  private providerCache = new Map<string, CachedProvider>();
  /** In-memory Promise coalescing: same-process concurrent requests share one flight */
  private inflightGetProvider = new Map<string, Promise<ProviderInterface>>();
  /** Reusable Redis lock provider (lazy-initialized once) */
  private _redisLock: RedisLockProvider | null = null;

  constructor(db: Database, opts: PersistentSandboxManagerOptions = {}) {
    this.db = db;
    this.localBaseDir = opts.localBaseDir;
    this.volumeProvider = opts.volumeProvider ?? noopVolumeMountProvider;
    this.getRedisClient = opts.getRedisClient;
  }

  /** Get or create a shared RedisLockProvider instance, if a Redis client was configured. */
  private async getRedisLock(): Promise<RedisLockProvider | null> {
    if (this._redisLock) return this._redisLock;
    if (!this.getRedisClient) return null;
    const client = await this.getRedisClient();
    this._redisLock = new RedisLockProvider({
      client,
      keyPrefix: "sandock",
      acquireTimeoutMs: 120000,
      lockTTLms: 120000,
    });
    return this._redisLock;
  }

  /** Evict stale entries from provider cache */
  private pruneProviderCache(): void {
    const now = Date.now();
    for (const [id, entry] of this.providerCache) {
      if (now - entry.createdAt > PROVIDER_CACHE_TTL_MS) {
        this.providerCache.delete(id);
      }
    }
    // Evict oldest if over size limit
    if (this.providerCache.size > PROVIDER_CACHE_MAX_SIZE) {
      const entries = [...this.providerCache.entries()].sort(
        (a, b) => a[1].createdAt - b[1].createdAt,
      );
      const toRemove = entries.slice(0, entries.length - PROVIDER_CACHE_MAX_SIZE);
      for (const [id] of toRemove) {
        this.providerCache.delete(id);
      }
    }
  }

  /** Invalidate provider cache for a specific sandbox (e.g. after stop/delete) */
  private invalidateProviderCache(id: string): void {
    this.providerCache.delete(id);
  }

  private scheduleDeadlineStop(row: Sandbox, activeDeadlineSeconds?: number): void {
    if (!activeDeadlineSeconds || row.provider === "KUBERNETES") return;

    const sandboxId = row.id;
    const deadlineMs = activeDeadlineSeconds * 1000;
    setTimeout(() => {
      void this.stop(sandboxId).catch((e) => {
        console.error(`[SandboxManager] deadline timer failed to stop sandbox ${sandboxId}:`, e);
      });
      console.log(
        `[SandboxManager] deadline timer stopped sandbox ${sandboxId} after ${activeDeadlineSeconds}s`,
      );
    }, deadlineMs).unref();
  }

  /** Reserve the sandbox row and related mount records without starting provider resources. */
  async reserve(input: ReserveSandboxInput): Promise<Sandbox> {
    const client = input.dbClient ?? this.db;
    const providerEnum: SandboxProvider = input.forceProvider || providerName;
    const targetSpaceId = input.spaceId ?? null;
    const volumeMounts = input.volumes ?? [];

    // Validate volume mounts if provided
    if (volumeMounts.length > 0) {
      const validation = await this.volumeProvider.validateMounts(targetSpaceId, volumeMounts);
      if (!validation.valid) {
        throw new Error(`VOLUME_MOUNT_VALIDATION_FAILED: ${validation.errors.join("; ")}`);
      }
    }

    const volMap = new Map<string, Awaited<ReturnType<typeof this.volumeProvider.getRaw>>>();
    for (const mount of volumeMounts) {
      if (!volMap.has(mount.volumeId)) {
        volMap.set(mount.volumeId, await this.volumeProvider.getRaw(mount.volumeId));
      }
    }

    // EBS volumes are ReadWriteOnce and node-bound; only one EBS volume per sandbox
    const ebsVolumeIds = [...volMap.entries()]
      .filter(([, v]) => v.storageType === "ebs")
      .map(([id]) => id);
    if (ebsVolumeIds.length > 1) {
      throw new Error(
        `EBS_SINGLE_VOLUME_LIMIT: Only one EBS volume can be mounted per sandbox, got ${ebsVolumeIds.length}: ${ebsVolumeIds.join(", ")}`,
      );
    }

    // Initial DB row (status CREATING)
    // Store activeDeadlineSeconds in metadata for reconciler to check runtime limits
    const sandboxMetadata = {
      ...(input.metadata ?? {}),
      ...(input.activeDeadlineSeconds
        ? { activeDeadlineSeconds: input.activeDeadlineSeconds }
        : {}),
      ...(input.clusterId ? { clusterId: input.clusterId } : {}),
    };
    const result = await client
      .insert(sandboxes)
      .values({
        id: generateNanoID("sdb"),
        userId: input.userId,
        spaceId: targetSpaceId,
        title: input.title,
        provider: providerEnum,
        status: "CREATING" as SandboxStatus,
        image: input.image || null,
        cpuLimit: input.cpuLimit ?? null,
        memoryLimit: input.memoryLimit ?? null,
        command: input.command ?? null,
        env: input.env ?? null,
        metadata: Object.keys(sandboxMetadata).length > 0 ? sandboxMetadata : null,
        autoDeleteInterval: input.autoDeleteInterval ?? null,
      })
      .returning();
    const row = result[0];

    // Record volume mounts to database
    if (volumeMounts.length > 0) {
      await this.volumeProvider.recordMounts(row.id, volumeMounts, client);
    }

    await recordStatusEvent(this.db, {
      sandboxId: row.id,
      type: "CREATED",
      toStatus: "CREATING" as SandboxStatus,
      tx: client,
    });
    return row;
  }

  /** Start a reserved sandbox provider and update DB status. */
  async startReserved(row: Sandbox): Promise<Sandbox> {
    try {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const activeDeadlineSeconds = meta.activeDeadlineSeconds as number | undefined;
      const clusterId = meta.clusterId as string | undefined;
      const volumeMounts = await this.volumeProvider.getMounts(row.id);

      const volMap = new Map<string, Awaited<ReturnType<typeof this.volumeProvider.getRaw>>>();
      for (const mount of volumeMounts) {
        if (!volMap.has(mount.volumeId)) {
          volMap.set(mount.volumeId, await this.volumeProvider.getRaw(mount.volumeId));
        }
      }

      // Generate provider-specific volume mount configs
      const providerVolumeMounts = await this.generateProviderVolumeMounts(
        row.provider,
        row.spaceId,
        volumeMounts,
        volMap,
      );

      // Extract node affinity from EBS volumes (from volume record, not mount input)
      let nodeName: string | undefined;
      for (const mount of volumeMounts) {
        const vol = volMap.get(mount.volumeId);
        if (vol?.storageType === "ebs" && vol.boundNode) {
          nodeName = vol.boundNode;
          break;
        }
      }

      // Resolve clusterId → kubeconfigBase64 from env config
      let kubeconfigBase64: string | undefined;
      if (clusterId) {
        const { resolveClusterKubeconfig } = await import("./cluster-config");
        kubeconfigBase64 = resolveClusterKubeconfig(clusterId);
        if (!kubeconfigBase64) {
          throw new Error(
            `Cluster "${clusterId}" not found or has no kubeconfig in CLUSTER_CONFIGS`,
          );
        }
      }

      const provider = await this.instantiateProvider(row, {
        image: row.image ?? undefined,
        activeDeadlineSeconds,
        command: row.command ?? undefined,
        volumeMounts: providerVolumeMounts,
        nodeName,
        kubeconfigBase64,
        env: row.env ?? undefined,
      });
      await recordStatusEvent(this.db, { sandboxId: row.id, type: "START_ATTEMPT" });
      const providerRef = await provider.start();
      await this.syncVolumeNodeAffinity(provider, row.provider, row.id);

      const updated = await this.db
        .update(sandboxes)
        .set({
          status: "RUNNING" as SandboxStatus,
          providerRef: providerRef,
          lastHeartbeatAt: new Date(),
          statusChangedAt: new Date(),
        })
        .where(eq(sandboxes.id, row.id))
        .returning();
      await recordStartSuccess(this.db, row.id, row.createdAt, false);
      await recordStatusEvent(this.db, {
        sandboxId: row.id,
        fromStatus: "CREATING" as SandboxStatus,
        toStatus: "RUNNING" as SandboxStatus,
      });

      this.scheduleDeadlineStop(row, activeDeadlineSeconds);

      return updated[0];
    } catch (e) {
      await this.db
        .update(sandboxes)
        .set({
          status: "ERROR" as SandboxStatus,
          metadata: { ...(row.metadata as Record<string, unknown>), error: String(e) },
          statusChangedAt: new Date(),
        })
        .where(eq(sandboxes.id, row.id));
      await recordStatusEvent(this.db, {
        sandboxId: row.id,
        fromStatus: "CREATING" as SandboxStatus,
        toStatus: "ERROR" as SandboxStatus,
        type: "START_FAIL",
        meta: { error: String(e) },
      });
      throw e;
    }
  }

  /** Create sandbox row, then start provider resources. */
  async create(input: CreateSandboxInput): Promise<Sandbox> {
    const row = await this.reserve(input);
    return this.startReserved(row);
  }

  /** Generate provider-specific volume mount configurations */
  private async generateProviderVolumeMounts(
    provider: SandboxProvider,
    spaceId: string | null,
    mounts: VolumeMountInput[],
    volCache?: Map<string, Awaited<ReturnType<typeof this.volumeProvider.getRaw>>>,
  ): Promise<
    Array<{
      source: string;
      target: string;
      readOnly?: boolean;
      storageType?: "ebs" | "s3";
      pvcName?: string;
    }>
  > {
    const result: Array<{
      source: string;
      target: string;
      readOnly?: boolean;
      storageType?: "ebs" | "s3";
      pvcName?: string;
    }> = [];

    for (const mount of mounts) {
      const volume =
        volCache?.get(mount.volumeId) ?? (await this.volumeProvider.getRaw(mount.volumeId));
      const providerMount = this.volumeProvider.generateProviderVolumeMount(
        provider,
        spaceId,
        volume.id,
        mount.mountPath,
        mount.subpath,
      );
      result.push({
        ...providerMount,
        storageType: volume.storageType as "ebs" | "s3",
        pvcName: volume.pvcName ?? undefined,
      });
    }

    return result;
  }

  /** Get sandbox row (throws if not found or deleted) */
  async get(id: string): Promise<Sandbox> {
    const result = await this.db.select().from(sandboxes).where(eq(sandboxes.id, id)).limit(1);
    if (!result.length) throw new Error("Sandbox not found");
    const row = result[0];
    if (row.deletedAt) throw new Error("Sandbox deleted");
    return row;
  }

  /** Restore all provider-creation extras from DB for an existing sandbox */
  private async restoreProviderExtras(row: Sandbox) {
    const mounts = await this.volumeProvider.getMounts(row.id);
    const volumeMounts =
      mounts.length > 0
        ? await this.generateProviderVolumeMounts(row.provider, row.spaceId, mounts)
        : undefined;

    // Restore node affinity from bound volumes (for EBS re-scheduling)
    let nodeName: string | undefined;
    if (mounts.length > 0) {
      for (const mount of mounts) {
        try {
          const vol = await this.volumeProvider.getRaw(mount.volumeId);
          if (vol.boundNode && vol.storageType === "ebs") {
            nodeName = vol.boundNode;
            break;
          }
        } catch {
          /* volume may have been deleted */
        }
      }
    }

    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const clusterId = typeof meta.clusterId === "string" ? meta.clusterId : undefined;
    let kubeconfigBase64: string | undefined;
    if (clusterId) {
      const { resolveClusterKubeconfig } = await import("./cluster-config");
      kubeconfigBase64 = resolveClusterKubeconfig(clusterId);
      if (!kubeconfigBase64) {
        throw new Error(`Cluster "${clusterId}" not found or has no kubeconfig in CLUSTER_CONFIGS`);
      }
    }

    return {
      image: row.image || undefined,
      activeDeadlineSeconds: (meta.activeDeadlineSeconds as number) ?? undefined,
      command: row.command ?? undefined,
      volumeMounts,
      nodeName,
      kubeconfigBase64,
      env: row.env ?? undefined,
    };
  }

  /** Sync EBS volume boundNode if the actual scheduled node changes */
  private async syncVolumeNodeAffinity(
    provider: ProviderInterface,
    providerType: SandboxProvider,
    sandboxId: string,
  ) {
    if (providerType !== "KUBERNETES") return;
    const k8sProvider = provider as import("./sandbox").KubernetesSandboxProvider;
    const actualNode = k8sProvider.getScheduledNode();
    if (!actualNode) return;

    const mounts = await this.volumeProvider.getMounts(sandboxId);
    for (const mount of mounts) {
      try {
        const vol = await this.volumeProvider.getRaw(mount.volumeId);
        if (vol.storageType === "ebs" && vol.boundNode !== actualNode) {
          await this.volumeProvider.updateBoundNode(vol.id, actualNode);
        }
      } catch {
        // ignore deleted volumes
      }
    }
  }

  /** Ensure a provider instance for given sandbox id. Starts if necessary. */
  async getProvider(id: string): Promise<ProviderInterface> {
    // Same-process coalescing: N concurrent calls share one flight
    const inflight = this.inflightGetProvider.get(id);
    if (inflight) return inflight;

    const promise = this._doGetProvider(id).finally(() => {
      this.inflightGetProvider.delete(id);
    });
    this.inflightGetProvider.set(id, promise);
    return promise;
  }

  /** Internal: acquire Redis lock (if configured), start provider, update DB. */
  private async _doGetProvider(id: string): Promise<ProviderInterface> {
    let redisLockToken: string | null = null;
    let redisLock: RedisLockProvider | null = null;

    try {
      try {
        redisLock = await this.getRedisLock();
        if (redisLock) {
          redisLockToken = await redisLock.acquire(id);
        }
      } catch (e) {
        console.warn(
          `[SandboxManager] Failed to acquire Redis lock for sandbox ${id}, proceeding without distributed lock:`,
          e,
        );
      }

      const row = await this.get(id);

      // --- L1 cache: reuse provider if sandbox is RUNNING and cache is fresh ---
      this.pruneProviderCache();
      const cached = this.providerCache.get(id);
      if (
        cached &&
        row.status === "RUNNING" &&
        cached.dbStatus === "RUNNING" &&
        Date.now() - cached.createdAt < PROVIDER_CACHE_TTL_MS
      ) {
        return cached.provider;
      }

      const extras = await this.restoreProviderExtras(row);
      const provider = await this.instantiateProvider(row, extras);

      // Always call start() to ensure provider reconnects to existing container
      // Docker/Kubernetes providers will find existing containers by ID
      if (row.status !== "RUNNING") {
        try {
          await recordStatusEvent(this.db, {
            sandboxId: id,
            type: "START_ATTEMPT",
            fromStatus: row.status,
            toStatus: "RUNNING" as SandboxStatus,
          });
          const ref = await provider.start();
          await this.syncVolumeNodeAffinity(provider, row.provider, id);

          await this.db
            .update(sandboxes)
            .set({
              status: "RUNNING" as SandboxStatus,
              providerRef: ref,
              lastHeartbeatAt: new Date(),
              statusChangedAt: new Date(),
            })
            .where(eq(sandboxes.id, id));
          await recordStartSuccess(this.db, id, row.createdAt, row.status !== "CREATING");
          await recordStatusEvent(this.db, {
            sandboxId: id,
            fromStatus: row.status,
            toStatus: "RUNNING" as SandboxStatus,
          });
          this.scheduleDeadlineStop(row, extras.activeDeadlineSeconds);
        } catch (e) {
          await this.db
            .update(sandboxes)
            .set({
              status: "ERROR" as SandboxStatus,
              metadata: { ...(row.metadata as Record<string, unknown>), restartError: String(e) },
              statusChangedAt: new Date(),
            })
            .where(eq(sandboxes.id, id));
          await recordStatusEvent(this.db, {
            sandboxId: id,
            fromStatus: row.status,
            toStatus: "ERROR" as SandboxStatus,
            type: "RESTART_FAIL",
            meta: { error: String(e) },
          });
          throw e;
        }
      } else {
        // Sandbox is already RUNNING in DB, reconnect provider to existing container
        try {
          await provider.start();
          await this.syncVolumeNodeAffinity(provider, row.provider, id);
        } catch (e) {
          // If reconnection fails, update status to ERROR
          await this.db
            .update(sandboxes)
            .set({
              status: "ERROR" as SandboxStatus,
              metadata: {
                ...(row.metadata as Record<string, unknown>),
                reconnectError: String(e),
              },
              statusChangedAt: new Date(),
            })
            .where(eq(sandboxes.id, id));
          await recordStatusEvent(this.db, {
            sandboxId: id,
            fromStatus: "RUNNING" as SandboxStatus,
            toStatus: "ERROR" as SandboxStatus,
            type: "RESTART_FAIL",
            meta: { error: String(e) },
          });
          throw e;
        }
      }
      // Populate cache after successful start/reconnect
      this.providerCache.set(id, {
        provider,
        dbStatus: "RUNNING" as SandboxStatus,
        createdAt: Date.now(),
      });
      return provider;
    } finally {
      if (redisLockToken && redisLock) {
        await redisLock.release(id, redisLockToken).catch((e) => {
          console.warn(`[SandboxManager] Failed to release Redis lock for sandbox ${id}:`, e);
        });
      }
    }
  }

  /** Stop provider resources and mark STOPPED */
  async stop(id: string): Promise<void> {
    this.invalidateProviderCache(id);
    const row = await this.get(id);
    if (row.status === "STOPPED" || row.status === "DELETED" || row.deletedAt) return;
    const provider = await this.instantiateProvider(row, await this.restoreProviderExtras(row));
    try {
      await provider.start(); // ensure handle for stop logic (docker/local rely on active reference discovery)
    } catch {}
    try {
      await provider.stop();
    } catch (e) {
      // record error but continue
      await this.db
        .update(sandboxes)
        .set({ metadata: { ...(row.metadata as Record<string, unknown>), stopError: String(e) } })
        .where(eq(sandboxes.id, id));
    }
    await this.db
      .update(sandboxes)
      .set({ status: "STOPPED" as SandboxStatus, statusChangedAt: new Date() })
      .where(eq(sandboxes.id, id));
    await closeRunSegment(this.db, id, "STOPPED");
    await recordStatusEvent(this.db, {
      sandboxId: id,
      fromStatus: row.status,
      toStatus: "STOPPED" as SandboxStatus,
      type: "STOP",
    });
  }

  /** Pause sandbox (save state, stop billing) */
  async pause(id: string): Promise<void> {
    this.invalidateProviderCache(id);
    const row = await this.get(id);
    if (row.status !== "RUNNING") {
      throw new Error(`Cannot pause sandbox in ${row.status} state`);
    }

    const provider = await this.instantiateProvider(row, await this.restoreProviderExtras(row));

    try {
      // For K8s: scale down to 0 replicas (preserves PVC)
      // For Docker: pause container (preserves memory state)
      await provider.stop();

      await this.db
        .update(sandboxes)
        .set({
          status: "PAUSED" as SandboxStatus,
          lastPausedAt: new Date(),
          statusChangedAt: new Date(),
        })
        .where(eq(sandboxes.id, id));

      await closeRunSegment(this.db, id, "PAUSED");
      await recordStatusEvent(this.db, {
        sandboxId: id,
        fromStatus: "RUNNING" as SandboxStatus,
        toStatus: "PAUSED" as SandboxStatus,
        type: "PAUSE",
      });
    } catch (e) {
      await this.db
        .update(sandboxes)
        .set({
          status: "ERROR" as SandboxStatus,
          metadata: { ...(row.metadata as Record<string, unknown>), pauseError: String(e) },
        })
        .where(eq(sandboxes.id, id));
      throw e;
    }
  }

  /** Resume sandbox (restore state, resume billing) */
  async resume(id: string): Promise<void> {
    const row = await this.get(id);
    if (row.status !== "PAUSED") {
      throw new Error(`Cannot resume sandbox in ${row.status} state`);
    }

    try {
      await recordStatusEvent(this.db, {
        sandboxId: id,
        type: "RESUME_ATTEMPT",
        fromStatus: "PAUSED" as SandboxStatus,
        toStatus: "RUNNING" as SandboxStatus,
      });

      const provider = await this.instantiateProvider(row, await this.restoreProviderExtras(row));
      const ref = await provider.start();
      await this.syncVolumeNodeAffinity(provider, row.provider, id);

      await this.db
        .update(sandboxes)
        .set({
          status: "RUNNING" as SandboxStatus,
          providerRef: ref,
          lastResumedAt: new Date(),
          lastHeartbeatAt: new Date(),
          statusChangedAt: new Date(),
        })
        .where(eq(sandboxes.id, id));

      await recordStartSuccess(this.db, id, row.createdAt, true);
      await recordStatusEvent(this.db, {
        sandboxId: id,
        fromStatus: "PAUSED" as SandboxStatus,
        toStatus: "RUNNING" as SandboxStatus,
        type: "RESUME_SUCCESS",
      });
    } catch (e) {
      await this.db
        .update(sandboxes)
        .set({
          status: "ERROR" as SandboxStatus,
          metadata: { ...(row.metadata as Record<string, unknown>), resumeError: String(e) },
        })
        .where(eq(sandboxes.id, id));
      await recordStatusEvent(this.db, {
        sandboxId: id,
        fromStatus: "PAUSED" as SandboxStatus,
        toStatus: "ERROR" as SandboxStatus,
        type: "RESUME_FAIL",
        meta: { error: String(e) },
      });
      throw e;
    }
  }

  /** Soft delete -> mark DELETING -> stop -> mark DELETED (Note: Space volume is preserved) */
  async delete(id: string): Promise<void> {
    this.invalidateProviderCache(id);
    const row = await this.get(id);
    if (row.deletedAt) return;
    await this.db
      .update(sandboxes)
      .set({ status: "DELETING" as SandboxStatus, statusChangedAt: new Date() })
      .where(eq(sandboxes.id, id));
    await recordStatusEvent(this.db, {
      sandboxId: id,
      fromStatus: row.status,
      toStatus: "DELETING" as SandboxStatus,
      type: "DELETE_ATTEMPT",
    });
    try {
      await this.stop(id);
      // Only mark DELETED after pod/container is actually stopped
      await this.db
        .update(sandboxes)
        .set({
          status: "DELETED" as SandboxStatus,
          deletedAt: new Date(),
          statusChangedAt: new Date(),
        })
        .where(eq(sandboxes.id, id));
      await recordStatusEvent(this.db, {
        sandboxId: id,
        fromStatus: "DELETING" as SandboxStatus,
        toStatus: "DELETED" as SandboxStatus,
        type: "DELETED",
      });
    } catch (e) {
      // Pod deletion failed — keep status as DELETING so reconciler can find
      // the orphaned pod via sandbox-id label and clean it up later.
      // Record the error for debugging, then mark DELETED since the DB record
      // is no longer useful, and the orphan reconciler will handle the pod.
      await this.db
        .update(sandboxes)
        .set({
          status: "DELETED" as SandboxStatus,
          deletedAt: new Date(),
          statusChangedAt: new Date(),
          metadata: {
            ...(row.metadata as Record<string, unknown> | null),
            deleteError: String(e),
            deleteErrorAt: new Date().toISOString(),
          },
        })
        .where(eq(sandboxes.id, id));
      await recordStatusEvent(this.db, {
        sandboxId: id,
        fromStatus: "DELETING" as SandboxStatus,
        toStatus: "DELETED" as SandboxStatus,
        type: "DELETED",
        meta: { error: String(e) },
      });
    }
    // Note: Space-level volume is NOT deleted here (persistent mount mode)
    // Volume persists and can be reused by new sandboxes in the same space
  }

  /** Heartbeat updates lastHeartbeatAt */
  async heartbeat(id: string): Promise<void> {
    await this.db
      .update(sandboxes)
      .set({ lastHeartbeatAt: new Date() })
      .where(eq(sandboxes.id, id));
    await recordStatusEvent(this.db, { sandboxId: id, type: "HEARTBEAT" });
  }

  /** List sandboxes (filter by optional space + optional status). */
  async list(opts: { spaceId?: string | null; status?: SandboxStatus[] }): Promise<Sandbox[]> {
    const conditions = [isNull(sandboxes.deletedAt)];
    if (opts.spaceId !== undefined) {
      if (opts.spaceId === null) {
        conditions.push(isNull(sandboxes.spaceId));
      } else {
        conditions.push(eq(sandboxes.spaceId, opts.spaceId));
      }
    }
    if (opts.status && opts.status.length > 0) {
      conditions.push(inArray(sandboxes.status, opts.status));
    }
    return this.db
      .select()
      .from(sandboxes)
      .where(and(...conditions))
      .orderBy(sandboxes.createdAt);
  }

  /** Instantiate provider based on DB row. Caching is done at getProvider() level. */
  private async instantiateProvider(
    row: Sandbox,
    extra: {
      image?: string;
      activeDeadlineSeconds?: number;
      command?: string[];
      volumeMounts?: Array<{
        source: string;
        target: string;
        readOnly?: boolean;
        storageType?: "ebs" | "s3";
        pvcName?: string;
      }>;
      nodeName?: string;
      kubeconfigBase64?: string;
      env?: Record<string, string>;
    },
  ): Promise<ProviderInterface> {
    const name = row.provider;

    switch (name) {
      case "DOCKER":
        return createSandboxProvider("DOCKER", {
          id: row.id,
          image: extra.image,
          pull: true,
          memoryLimitMb: row.memoryLimit ?? undefined,
          cpuShares: row.cpuLimit ?? undefined,
          volumeMounts: extra.volumeMounts,
          env: extra.env,
        });
      case "LOCAL":
        return createSandboxProvider("LOCAL", {
          id: row.id,
          workdir: this.localBaseDir,
          env: extra.env,
        });
      case "KUBERNETES":
        return createSandboxProvider("KUBERNETES", {
          sandboxId: row.id,
          image: extra.image,
          memoryLimitMb: row.memoryLimit ?? undefined,
          cpuLimit: row.cpuLimit ? `${row.cpuLimit}m` : undefined,
          spaceId: row.spaceId ?? undefined,
          activeDeadlineSeconds: extra.activeDeadlineSeconds,
          command: extra.command,
          volumeMounts: extra.volumeMounts,
          nodeName: extra.nodeName,
          kubeconfigBase64: extra.kubeconfigBase64,
          env: extra.env,
        });
      default:
        throw new Error(`Unsupported provider ${name}`);
    }
  }
}
