import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { type Sandbox, type SandboxProvider, type SandboxStatus, sandboxes } from "./db/schema";
import { closeRunSegment, recordStatusEvent } from "./metrics";
import type { SandboxManager } from "./sandbox-manager";

/** How long (ms) a terminated pod (Succeeded/Failed/OOMKilled) lingers before auto-deletion from K8s. */
const TERMINATED_POD_TTL_MS = 3 * 60_000; // 3 minutes

/** Label selector for sandock-managed sandbox pods in K8s. */
const SANDOCK_POD_LABEL_SELECTOR = "app=sandbox,managed-by=sandock";

export interface SandboxReconcilerOptions {
  intervalMs?: number;
  batchSize?: number;
  verbose?: boolean;
}

/** Helper to extract existing reconcile metadata from sandbox */
function getExistingReconcile(sb: Sandbox): Record<string, unknown> {
  const meta = sb.metadata as unknown;
  if (
    meta &&
    typeof meta === "object" &&
    "reconcile" in meta &&
    typeof (meta as { reconcile?: unknown }).reconcile === "object"
  ) {
    return (meta as { reconcile: Record<string, unknown> }).reconcile;
  }
  return {} as Record<string, unknown>;
}

/** Helper to get activeDeadlineSeconds from sandbox metadata */
function getActiveDeadlineSeconds(sb: Sandbox): number | undefined {
  const meta = sb.metadata as unknown;
  if (
    meta &&
    typeof meta === "object" &&
    "activeDeadlineSeconds" in meta &&
    typeof (meta as { activeDeadlineSeconds?: unknown }).activeDeadlineSeconds === "number"
  ) {
    return (meta as { activeDeadlineSeconds: number }).activeDeadlineSeconds;
  }
  return undefined;
}

/** Check if sandbox has exceeded its activeDeadlineSeconds based on last start time */
function hasExceededDeadline(sb: Sandbox): boolean {
  const deadlineSeconds = getActiveDeadlineSeconds(sb);
  if (!deadlineSeconds) return false;

  // Use lastStartedAt (most recent start/restart) so restarting resets the deadline timer
  const startTime = sb.lastStartedAt ?? sb.firstStartedAt ?? sb.createdAt;
  if (!startTime) return false;

  const elapsedMs = Date.now() - startTime.getTime();
  const deadlineMs = deadlineSeconds * 1000;
  return elapsedMs > deadlineMs;
}

/** Mark a sandbox as STOPPED with reconcile metadata */
async function markSandboxStopped(
  db: Database,
  sb: Sandbox,
  reason: Record<string, unknown>,
  verbose: boolean,
): Promise<void> {
  const existingReconcile = getExistingReconcile(sb);
  await db
    .update(sandboxes)
    .set({
      status: "STOPPED" as SandboxStatus,
      statusChangedAt: new Date(),
      metadata: {
        ...(sb.metadata as Record<string, unknown> | null),
        reconcile: {
          ...existingReconcile,
          lastObservedAt: new Date().toISOString(),
          ...reason,
        },
      },
    })
    .where(eq(sandboxes.id, sb.id));
  await closeRunSegment(db, sb.id, "RECONCILE");
  await recordStatusEvent(db, {
    sandboxId: sb.id,
    fromStatus: "RUNNING" as SandboxStatus,
    toStatus: "STOPPED" as SandboxStatus,
    type: "RECONCILE_STOP",
    meta: reason,
  });
  if (verbose) console.log("[reconcile] -> STOPPED", sb.id, reason);
}

export class SandboxReconciler {
  private db: Database;
  private sandboxManager: SandboxManager;
  private timer?: ReturnType<typeof setInterval>;
  private opts: Required<Pick<SandboxReconcilerOptions, "intervalMs" | "batchSize" | "verbose">>;

  constructor(db: Database, sandboxManager: SandboxManager, opts: SandboxReconcilerOptions = {}) {
    this.db = db;
    this.sandboxManager = sandboxManager;
    this.opts = {
      intervalMs: opts.intervalMs ?? 60_000,
      batchSize: opts.batchSize ?? 50,
      verbose: opts.verbose ?? false,
    };
  }

  /**
   * Reconciles the state of running sandboxes with their actual status.
   *
   * This method handles:
   * 1. Docker sandboxes: checks if container exists and is running
   * 2. Kubernetes sandboxes: checks if pod exists and is running
   * 3. All sandboxes: checks if activeDeadlineSeconds has been exceeded
   *
   * @async
   * @returns {Promise<void>} Resolves when reconciliation is complete for all batches.
   */
  async reconcileOnce() {
    await Promise.all([
      this.reconcileDockerSandboxes(),
      this.reconcileKubernetesSandboxes(),
      this.reconcileDeadlineExceeded(),
      this.reconcileTerminatedPods(),
      this.reconcileOrphanedPods(),
    ]);
  }

  /**
   * Reconciles Docker-based sandboxes with their actual container status.
   */
  private async reconcileDockerSandboxes() {
    const dockerMod = await import("dockerode");
    const docker = new dockerMod.default();
    let page = 0;
    while (true) {
      const sandboxList = await this.db
        .select()
        .from(sandboxes)
        .where(
          and(
            eq(sandboxes.status, "RUNNING" as SandboxStatus),
            eq(sandboxes.provider, "DOCKER" as SandboxProvider),
            isNull(sandboxes.deletedAt),
          ),
        )
        .orderBy(sandboxes.createdAt)
        .limit(this.opts.batchSize)
        .offset(page * this.opts.batchSize);
      if (!sandboxList.length) break;
      await Promise.all(
        sandboxList.map(async (sb) => {
          let containerStatus: string | undefined;
          const identifiers = [sb.providerRef, sb.id].filter(Boolean) as string[];
          let found = false;
          for (const ident of identifiers) {
            try {
              const container = docker.getContainer(ident);
              const inspect = await container.inspect();
              containerStatus = inspect.State?.Status;
              found = true;
              break;
            } catch {}
          }
          const existingReconcile = getExistingReconcile(sb);
          if (!found) {
            await markSandboxStopped(this.db, sb, { containerMissing: true }, this.opts.verbose);
            return;
          }
          if (containerStatus && containerStatus !== "running") {
            await markSandboxStopped(this.db, sb, { containerStatus }, this.opts.verbose);
          } else if (containerStatus) {
            await this.db
              .update(sandboxes)
              .set({
                metadata: {
                  ...(sb.metadata as Record<string, unknown> | null),
                  reconcile: {
                    ...existingReconcile,
                    lastObservedAt: new Date().toISOString(),
                    containerStatus,
                  },
                },
              })
              .where(eq(sandboxes.id, sb.id));
          }
        }),
      );
      if (sandboxList.length < this.opts.batchSize) break;
      page += 1;
    }
  }

  /**
   * Reconciles Kubernetes-based sandboxes with their actual pod status.
   */
  private async reconcileKubernetesSandboxes() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let k8sCore: any = null;
    let namespace = process.env.SANDBOX_K8S_NAMESPACE || "default";

    // Try to initialize Kubernetes client
    try {
      const k8sMod = await import("@kubernetes/client-node");
      const kc = new k8sMod.KubeConfig();
      kc.loadFromDefault();
      namespace = kc.getContextObject(kc.getCurrentContext())?.namespace || namespace;
      k8sCore = kc.makeApiClient(k8sMod.CoreV1Api);
    } catch {
      // Kubernetes client not available, skip K8s reconciliation
      return;
    }

    let page = 0;
    while (true) {
      const sandboxList = await this.db
        .select()
        .from(sandboxes)
        .where(
          and(
            eq(sandboxes.status, "RUNNING" as SandboxStatus),
            eq(sandboxes.provider, "KUBERNETES" as SandboxProvider),
            isNull(sandboxes.deletedAt),
          ),
        )
        .orderBy(sandboxes.createdAt)
        .limit(this.opts.batchSize)
        .offset(page * this.opts.batchSize);
      if (!sandboxList.length) break;
      await Promise.all(
        sandboxList.map(async (sb) => {
          let podPhase: string | undefined;
          const podName = sb.providerRef || sb.id;
          let found = false;

          try {
            const resp = (await k8sCore.readNamespacedPod({ name: podName, namespace })) as unknown;
            // Support either V1Pod or { body: V1Pod } format
            const podObj =
              resp && (resp as { body?: unknown }).body
                ? (resp as { body: { status?: { phase?: string } } }).body
                : (resp as { status?: { phase?: string } });
            podPhase = podObj?.status?.phase;
            found = true;
          } catch {
            // Pod not found or error reading
          }

          const existingReconcile = getExistingReconcile(sb);

          if (!found) {
            await markSandboxStopped(this.db, sb, { podMissing: true }, this.opts.verbose);
            return;
          }

          // Pod phases: Pending, Running, Succeeded, Failed, Unknown
          // Only "Running" means the sandbox is still active
          if (podPhase && podPhase !== "Running" && podPhase !== "Pending") {
            await markSandboxStopped(this.db, sb, { podPhase }, this.opts.verbose);
          } else if (podPhase) {
            await this.db
              .update(sandboxes)
              .set({
                metadata: {
                  ...(sb.metadata as Record<string, unknown> | null),
                  reconcile: {
                    ...existingReconcile,
                    lastObservedAt: new Date().toISOString(),
                    podPhase,
                  },
                },
              })
              .where(eq(sandboxes.id, sb.id));
          }
        }),
      );
      if (sandboxList.length < this.opts.batchSize) break;
      page += 1;
    }
  }

  /**
   * Reconciles sandboxes that have exceeded their activeDeadlineSeconds.
   * This handles cases where the underlying container/pod might still be running
   * but the sandbox should be stopped based on its configured runtime limit.
   */
  private async reconcileDeadlineExceeded() {
    let page = 0;
    while (true) {
      const sandboxList = await this.db
        .select()
        .from(sandboxes)
        .where(
          and(
            eq(sandboxes.status, "RUNNING" as SandboxStatus),
            // Check all providers that support activeDeadlineSeconds
            inArray(sandboxes.provider, ["DOCKER", "KUBERNETES", "LOCAL"] as SandboxProvider[]),
            isNull(sandboxes.deletedAt),
          ),
        )
        .orderBy(sandboxes.createdAt)
        .limit(this.opts.batchSize)
        .offset(page * this.opts.batchSize);
      if (!sandboxList.length) break;
      await Promise.all(
        sandboxList.map(async (sb) => {
          if (hasExceededDeadline(sb)) {
            const deadlineSeconds = getActiveDeadlineSeconds(sb);
            if (this.opts.verbose) {
              console.log("[reconcile] deadline exceeded, stopping sandbox", sb.id, {
                activeDeadlineSeconds: deadlineSeconds,
              });
            }
            try {
              // Actually stop the sandbox (this stops the container/pod and updates DB)
              await this.sandboxManager.stop(sb.id);
              // Update metadata to record that it was stopped due to deadline
              await this.db
                .update(sandboxes)
                .set({
                  metadata: {
                    ...(sb.metadata as Record<string, unknown> | null),
                    reconcile: {
                      ...getExistingReconcile(sb),
                      lastObservedAt: new Date().toISOString(),
                      deadlineExceeded: true,
                      activeDeadlineSeconds: deadlineSeconds,
                    },
                  },
                })
                .where(eq(sandboxes.id, sb.id));
            } catch (e) {
              // If stop fails, still mark as stopped in DB
              if (this.opts.verbose) {
                console.error("[reconcile] failed to stop sandbox", sb.id, e);
              }
              await markSandboxStopped(
                this.db,
                sb,
                {
                  deadlineExceeded: true,
                  activeDeadlineSeconds: deadlineSeconds,
                  stopError: String(e),
                },
                this.opts.verbose,
              );
            }
          }
        }),
      );
      if (sandboxList.length < this.opts.batchSize) break;
      page += 1;
    }
  }

  /**
   * Deletes K8s pods that have been in a terminal state (Succeeded, Failed, OOMKilled)
   * for longer than TERMINATED_POD_TTL_MS (5 minutes).
   *
   * This prevents terminated sandbox pods from lingering in the cluster.
   */
  private async reconcileTerminatedPods() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let k8sCore: any = null;
    let namespace = process.env.SANDBOX_K8S_NAMESPACE || "default";

    try {
      const k8sMod = await import("@kubernetes/client-node");
      const kc = new k8sMod.KubeConfig();
      kc.loadFromDefault();
      namespace = kc.getContextObject(kc.getCurrentContext())?.namespace || namespace;
      k8sCore = kc.makeApiClient(k8sMod.CoreV1Api);
    } catch {
      return;
    }

    try {
      const list = await k8sCore.listNamespacedPod({
        namespace,
        labelSelector: SANDOCK_POD_LABEL_SELECTOR,
      });
      const items = ((list as unknown as { body?: { items?: unknown[] } }).body?.items ||
        (list as unknown as { items?: unknown[] }).items ||
        []) as Array<{
        metadata?: { name?: string; deletionTimestamp?: string };
        status?: {
          phase?: string;
          startTime?: string;
          containerStatuses?: Array<{
            state?: {
              terminated?: { finishedAt?: string; reason?: string };
            };
          }>;
          conditions?: Array<{ type?: string; status?: string; lastTransitionTime?: string }>;
        };
      }>;

      const now = Date.now();

      for (const pod of items) {
        const phase = pod.status?.phase;
        // Skip pods that are still active or already being deleted
        if (!phase || phase === "Running" || phase === "Pending") continue;
        if (pod.metadata?.deletionTimestamp) continue;

        // Use container terminated finishedAt as the authoritative termination time.
        // Fallback to the "Ready=False" condition transition time which K8s sets when
        // the container exits. Do NOT use startTime — it reflects when the pod started,
        // not when it terminated, and would cause immediate deletion for long-running pods.
        const terminated = pod.status?.containerStatuses?.[0]?.state?.terminated;
        let finishedAt: number | undefined;
        if (terminated?.finishedAt) {
          finishedAt = Date.parse(terminated.finishedAt);
        }
        if (!finishedAt) {
          // When phase is Failed/Succeeded, the "Ready" condition transitions to False
          // at termination time — only use it if status is explicitly "False"
          const readyCond = pod.status?.conditions?.find(
            (c) => c.type === "Ready" && c.status === "False",
          );
          if (readyCond?.lastTransitionTime) {
            finishedAt = Date.parse(readyCond.lastTransitionTime);
          }
        }
        // If we can't determine when the pod actually terminated, skip it —
        // it will be picked up on a future cycle once K8s populates the status
        if (!finishedAt) continue;

        if (now - finishedAt < TERMINATED_POD_TTL_MS) continue;

        const podName = pod.metadata?.name;
        if (!podName) continue;

        const reason = terminated?.reason || phase;
        if (this.opts.verbose) {
          console.log("[reconcile] deleting terminated pod", podName, { reason, phase });
        }

        try {
          await k8sCore.deleteNamespacedPod({
            name: podName,
            namespace,
            gracePeriodSeconds: 0,
            propagationPolicy: "Background",
          });
        } catch {
          // Ignore errors (e.g. already deleted)
        }
      }
    } catch (e) {
      if (this.opts.verbose) {
        console.error("[reconcile] failed to reconcile terminated pods", e);
      }
    }
  }

  /**
   * Detects and cleans up orphaned K8s pods — pods that exist in the cluster
   * with `managed-by=sandock` but have no corresponding active (non-deleted) DB record.
   *
   * Root causes:
   * - Sandock crashed between pod creation and DB insert
   * - `delete()` marked DB as DELETED but pod deletion failed
   * - Network split during sandbox creation
   */
  private async reconcileOrphanedPods() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let k8sCore: any = null;
    let namespace = process.env.SANDBOX_K8S_NAMESPACE || "default";

    try {
      const k8sMod = await import("@kubernetes/client-node");
      const kc = new k8sMod.KubeConfig();
      kc.loadFromDefault();
      namespace = kc.getContextObject(kc.getCurrentContext())?.namespace || namespace;
      k8sCore = kc.makeApiClient(k8sMod.CoreV1Api);
    } catch {
      return;
    }

    try {
      // List all sandock-managed pods
      const list = await k8sCore.listNamespacedPod({
        namespace,
        labelSelector: SANDOCK_POD_LABEL_SELECTOR,
      });
      const items = ((list as unknown as { body?: { items?: unknown[] } }).body?.items ||
        (list as unknown as { items?: unknown[] }).items ||
        []) as Array<{
        metadata?: {
          name?: string;
          labels?: Record<string, string>;
          creationTimestamp?: string;
          deletionTimestamp?: string;
        };
        status?: { phase?: string };
      }>;

      if (items.length === 0) return;

      // Only consider pods that have been running for at least 5 minutes
      // to avoid racing with sandbox creation in progress
      const ORPHAN_GRACE_PERIOD_MS = 5 * 60_000;
      const now = Date.now();

      // Collect all sandbox-id labels from pods to batch-query DB
      const podsBySandboxId = new Map<
        string,
        Array<{ podName: string; phase?: string; createdAt: number }>
      >();
      const podsWithoutSandboxId: Array<{ podName: string; createdAt: number }> = [];

      for (const pod of items) {
        const podName = pod.metadata?.name;
        if (!podName) continue;
        // Skip pods already being deleted
        if (pod.metadata?.deletionTimestamp) continue;

        const createdAt = pod.metadata?.creationTimestamp
          ? Date.parse(pod.metadata.creationTimestamp)
          : now;
        // Skip recently created pods (grace period)
        if (now - createdAt < ORPHAN_GRACE_PERIOD_MS) continue;

        const sandboxId = pod.metadata?.labels?.["sandbox-id"];
        if (sandboxId) {
          const arr = podsBySandboxId.get(sandboxId) || [];
          arr.push({ podName, phase: pod.status?.phase, createdAt });
          podsBySandboxId.set(sandboxId, arr);
        } else {
          podsWithoutSandboxId.push({ podName, createdAt });
        }
      }

      // Batch query DB for all sandbox IDs found on pods
      const allSandboxIds = [...podsBySandboxId.keys()];
      const existingDbIds = new Set<string>();
      if (allSandboxIds.length > 0) {
        // Query in batches of 100 to avoid query size limits
        for (let i = 0; i < allSandboxIds.length; i += 100) {
          const batch = allSandboxIds.slice(i, i + 100);
          const rows = await this.db
            .select({ id: sandboxes.id })
            .from(sandboxes)
            .where(and(inArray(sandboxes.id, batch), isNull(sandboxes.deletedAt)));
          for (const row of rows) {
            existingDbIds.add(row.id);
          }
        }
      }

      // Delete orphaned pods (those with sandbox-id not in DB, or no sandbox-id at all)
      const orphanPodNames: string[] = [];

      for (const [sandboxId, pods] of podsBySandboxId) {
        if (!existingDbIds.has(sandboxId)) {
          for (const pod of pods) {
            orphanPodNames.push(pod.podName);
          }
        }
      }

      // Pods without sandbox-id label are also orphans (failed creation)
      for (const pod of podsWithoutSandboxId) {
        orphanPodNames.push(pod.podName);
      }

      if (orphanPodNames.length === 0) return;

      if (this.opts.verbose) {
        console.log(
          `[reconcile] found ${orphanPodNames.length} orphaned pods to clean up:`,
          orphanPodNames,
        );
      }

      for (const podName of orphanPodNames) {
        try {
          await k8sCore.deleteNamespacedPod({
            name: podName,
            namespace,
            gracePeriodSeconds: 0,
            propagationPolicy: "Background",
          });
          if (this.opts.verbose) {
            console.log("[reconcile] deleted orphaned pod", podName);
          }
        } catch {
          // Ignore errors (e.g. already deleted, 404)
        }
      }
    } catch (e) {
      if (this.opts.verbose) {
        console.error("[reconcile] failed to reconcile orphaned pods", e);
      }
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.reconcileOnce().catch((e) => {
        if (process.env.NODE_ENV !== "production") console.error("[SandboxReconciler] error", e);
      });
    }, this.opts.intervalMs).unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer as unknown as NodeJS.Timeout);
    this.timer = undefined;
  }
}
