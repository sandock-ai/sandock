// Node.js environment typings and APIs
// Kubernetes based sandbox provider.
// Goals (minimal viable):
// 1. Create ephemeral Pod with single container for execution
// 2. Exec shell commands inside container
// 3. Simple file ops implemented via shell (cat/ls/rm) & base64 for write
// 4. Run code snippets by writing temp file then executing interpreter
// NOTE: This implementation intentionally avoids streaming and advanced copy APIs
// to keep dependency surface small. It uses dynamic import so library remains usable
// without k8s dependency until provider is instantiated.

/*
  NOTE: This file interacts with @kubernetes/client-node which lacks easy
  lightweight typings for dynamic runtime import. We avoid 'any' by using
  'unknown' and minimal internal helper types; remaining unavoidable casts
  are isolated in a few utility functions.
*/
import assert from "node:assert";
import { randomUUID } from "node:crypto";
// Use static import for fs to match other Node built-ins
import * as fs from "node:fs";
import { PassThrough, type Readable } from "node:stream";
import type { V1Pod } from "@kubernetes/client-node";
import {
  CoreV1Api,
  Exec,
  PortForward as K8sPortForward,
  KubeConfig,
} from "@kubernetes/client-node";
import * as tar from "tar-stream";
import { DEFAULT_SANDBOX_IMAGE } from "../constants";
import type {
  PortForwardHandle,
  PtySession,
  PtySessionOptions,
  SandboxCodeOptions,
  SandboxExecutionResult,
  SandboxFsWriteOptions,
  SandboxProvider,
  SandboxShellOptions,
  StreamEvent,
} from "../types";
import { buildEnvShellSnippet } from "../utils/env-tmpfile";

// ---------------------------------------------------------------------------
// K8s client singleton cache
// Shares KubeConfig + CoreV1Api across provider instances that use the same
// kubeconfig source, avoiding repeated file I/O and HTTP client construction.
// Key: "" for default/env/in-cluster, kubeconfigBase64 hash for per-instance.
// ---------------------------------------------------------------------------
interface CachedK8sClient {
  kc: KubeConfig;
  core: CoreV1Api;
  createdAt: number;
}
const k8sClientCache = new Map<string, CachedK8sClient>();
/** Max age before a cached client is considered stale (5 min) */
const K8S_CLIENT_MAX_AGE_MS = 5 * 60 * 1000;

class ResizablePassThrough extends PassThrough {
  columns: number;
  rows: number;

  constructor(columns: number, rows: number) {
    super();
    this.columns = columns;
    this.rows = rows;
  }

  resize(columns: number, rows: number): void {
    if (this.columns === columns && this.rows === rows) return;
    this.columns = columns;
    this.rows = rows;
    this.emit("resize");
  }
}

export interface KubernetesSandboxOptions {
  namespace?: string; // target namespace (default: default)
  image?: string; // container image (default sandockai/sandock-code:latest)
  workdir?: string; // working directory inside container (default /sandbox)
  memoryLimitMb?: number; // memory limit
  cpuLimit?: string; // cpu limit (e.g., '500m')
  podName?: string; // stable name (if omitted random)
  pullPolicy?: "IfNotPresent" | "Always";
  idleSeconds?: number; // pod sleep duration (to keep alive)
  // One or more imagePullSecret names to use when pulling private images.
  // Can also be provided via env:
  //  - SANDBOX_K8S_IMAGE_PULL_SECRETS: comma-separated list
  //  - SANDBOX_K8S_IMAGE_PULL_SECRET: single name (legacy)
  imagePullSecrets?: string[];
  // Space ID for multi-tenant isolation (used to label and filter pods)
  spaceId?: string;
  // Sandbox ID for explicit instance reuse. If provided, pods with this sandbox-id label will be reused.
  sandboxId?: string;
  // Maximum runtime for pod in seconds (default: 1800, max: 86400)
  activeDeadlineSeconds?: number;
  // Optional command to override default container command
  command?: string[];
  // Volume mounts for persistent storage
  // storageType: "ebs" uses a dedicated PVC per volume; "s3" (default) uses shared PVC with subPath
  volumeMounts?: Array<{
    source: string;
    target: string;
    readOnly?: boolean;
    storageType?: "ebs" | "s3";
    pvcName?: string;
  }>;
  // Force-schedule Pod to a specific node (EBS affinity)
  nodeName?: string;
  // Kubeconfig override (base64-encoded) for multi-cluster routing
  kubeconfigBase64?: string;
  // Environment variables to set in the container
  env?: Record<string, string>;
}

// Narrow interface subsets to keep dependency surface small
type IKubeConfig = KubeConfig;
type ICoreV1Api = CoreV1Api;

export class KubernetesSandboxProvider implements SandboxProvider {
  private opts: Required<
    Pick<
      KubernetesSandboxOptions,
      | "namespace"
      | "image"
      | "workdir"
      | "memoryLimitMb"
      | "cpuLimit"
      | "pullPolicy"
      | "idleSeconds"
      | "imagePullSecrets"
    >
  > & {
    serviceAccountName: string;
    podName?: string;
    spaceId?: string;
    sandboxId?: string;
    activeDeadlineSeconds?: number;
    command?: string[];
    volumeMounts: Array<{
      source: string;
      target: string;
      readOnly?: boolean;
      storageType?: "ebs" | "s3";
      pvcName?: string;
    }>;
    nodeName?: string;
    kubeconfigBase64?: string;
    env?: Record<string, string>;
  };
  private podName?: string;
  private started = false;
  /** The actual K8S node the Pod was scheduled to (set after start()) */
  private scheduledNodeName?: string;
  /** Cached resolved namespace (set after first resolveNamespace call) */
  private _resolvedNs?: string;
  // Using unknown to avoid leaking 'any' while still allowing dynamic interaction without full type dep duplication
  private kc?: IKubeConfig;
  private core?: ICoreV1Api;
  private readonly managedByLabelValue = "sandock";

  constructor(options: KubernetesSandboxOptions = {}) {
    // Allow overriding via environment variables (prefixed to avoid collisions)
    // These are intentionally soft overrides (options param still has highest precedence)
    const env = process.env;
    const envNum = (key: string, d: number): number => {
      const v = env[key];
      if (!v) return d;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : d;
    };
    const parseSecrets = (v?: string): string[] =>
      (v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const envSecrets = Array.from(
      new Set([
        ...parseSecrets(env.SANDBOX_K8S_IMAGE_PULL_SECRETS),
        ...parseSecrets(env.SANDBOX_K8S_IMAGE_PULL_SECRET),
      ]),
    );
    this.opts = {
      // Leave empty to auto-detect (in-cluster SA file or kubeconfig); don't default to 'default' here
      namespace: (options.namespace ?? env.SANDBOX_K8S_NAMESPACE ?? "") as string,
      image: options.image ?? env.SANDBOX_K8S_IMAGE ?? DEFAULT_SANDBOX_IMAGE,
      workdir: options.workdir ?? env.SANDBOX_K8S_WORKDIR ?? "/sandbox",
      memoryLimitMb: options.memoryLimitMb ?? envNum("SANDBOX_K8S_MEMORY_MB", 512),
      cpuLimit: options.cpuLimit ?? env.SANDBOX_K8S_CPU_LIMIT ?? "500m",
      serviceAccountName: env.SANDBOX_K8S_SERVICE_ACCOUNT ?? "sandbox-runner-sa",
      pullPolicy:
        options.pullPolicy ??
        (["Always", "IfNotPresent"].includes(env.SANDBOX_K8S_PULL_POLICY || "")
          ? (env.SANDBOX_K8S_PULL_POLICY as "Always" | "IfNotPresent")
          : "IfNotPresent"),
      idleSeconds: options.idleSeconds ?? envNum("SANDBOX_K8S_IDLE_SECONDS", 3600),
      podName: options.podName ?? (env.SANDBOX_K8S_POD_NAME || undefined),
      imagePullSecrets: options.imagePullSecrets ?? envSecrets,
      spaceId: options.spaceId,
      sandboxId: options.sandboxId,
      activeDeadlineSeconds: options.activeDeadlineSeconds ?? 1800,
      command: options.command,
      volumeMounts: options.volumeMounts ?? [],
      nodeName: options.nodeName,
      kubeconfigBase64: options.kubeconfigBase64,
      env: options.env,
    };
  }

  private dbg(...args: unknown[]) {
    if (process.env.SANDBOX_DEBUG === "true") {
      // timestamped for easier correlation in CI logs
      const ts = new Date().toISOString();
      // eslint-disable-next-line no-console
      console.log("[SANDBOX][K8S]", ts, ...args);
    }
  }

  /**
   * Sanitize image name for use as Kubernetes label value.
   * K8s labels must be alphanumeric, -, _, or . and max 63 chars.
   * Replace invalid chars with -, remove leading/trailing -, truncate, and hash if needed.
   */
  private sanitizeImageForLabel(image: string): string {
    // Replace invalid characters with dashes
    let sanitized = image
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, ""); // Remove leading/trailing special chars

    // If too long, use a hash approach: keep first part + hash of full string
    if (sanitized.length > 63) {
      // Create a simple hash (not cryptographic, just for label uniqueness)
      let hash = 0;
      for (let i = 0; i < image.length; i++) {
        hash = (hash << 5) - hash + image.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      const hashStr = Math.abs(hash).toString(36);
      // Keep first 50 chars + hash (total ~56-58 chars)
      sanitized = `${sanitized.substring(0, 50)}-${hashStr}`;
    }

    return sanitized || "default";
  }

  // cpuLimit may be forms like '500m' or '1', convert to cores number
  get cpu(): number {
    const v = this.opts.cpuLimit.trim();
    if (v.endsWith("m")) {
      const n = Number(v.slice(0, -1));
      return Number.isFinite(n) ? +(n / 1000).toFixed(3) : 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  get mem(): number {
    return this.opts.memoryLimitMb * 1024 * 1024;
  }

  /** Resolve effective namespace: options -> SA file -> kubeconfig -> default */
  private async resolveNamespace(): Promise<string> {
    if (this._resolvedNs) return this._resolvedNs;
    const v = (this.opts.namespace || "").trim();
    if (v) {
      this._resolvedNs = v;
      return v;
    }
    let ns = "default";
    try {
      const nsPathCandidates = [
        "/var/run/secrets/kubernetes.io/serviceaccount/namespace",
        "/run/secrets/kubernetes.io/serviceaccount/namespace",
      ];
      for (const p of nsPathCandidates) {
        if (fs.existsSync(p)) {
          const found = fs.readFileSync(p, "utf8").trim();
          if (found) {
            ns = found;
            break;
          }
        }
      }
    } catch {}
    if (ns === "default") {
      try {
        if (this.kc) {
          const cur = this.kc.getCurrentContext();
          const ctx = this.kc.getContextObject(cur);
          const found = (ctx as { namespace?: string } | undefined)?.namespace?.trim();
          if (found) ns = found;
        }
      } catch {}
    }
    this._resolvedNs = ns;
    return ns;
  }

  /**
   * Compute a cache key for the K8s client singleton.
   * Per-instance kubeconfigBase64 gets its own key; everything else shares "".
   */
  private clientCacheKey(): string {
    return this.opts.kubeconfigBase64 || "";
  }

  private async loadClient() {
    if (this.kc) return;
    this.dbg("loadClient: start");

    // --- Singleton cache: reuse existing client if fresh ---
    const cacheKey = this.clientCacheKey();
    const cached = k8sClientCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < K8S_CLIENT_MAX_AGE_MS) {
      this.dbg("loadClient: reusing cached client (age", Date.now() - cached.createdAt, "ms)");
      this.kc = cached.kc;
      this.core = cached.core;
      // Still resolve namespace for this instance
      try {
        const ns = await this.resolveNamespace();
        if (ns) (this.opts as { namespace: string }).namespace = ns;
      } catch {}
      return;
    }

    // Precedence:
    // 0. Per-instance kubeconfigBase64 (multi-cluster routing)
    // 1. KUBECONFIG_BASE64/YAML (for simple one-line configuration)
    // 2. In-cluster mode (serviceaccount token)
    // 3. Default kubeconfig (~/.kube/config)
    const env = process.env;
    let kc: KubeConfig | undefined;
    try {
      if (this.opts.kubeconfigBase64) {
        this.dbg("loadClient: using per-instance kubeconfig (multi-cluster)");
        kc = new KubeConfig();
        const yaml = Buffer.from(this.opts.kubeconfigBase64, "base64").toString("utf-8");
        kc.loadFromString(yaml);
      } else if (env.SANDBOX_K8S_KUBECONFIG_BASE64 || env.SANDBOX_K8S_KUBECONFIG_YAML) {
        this.dbg("loadClient: using kubeconfig from env (BASE64/YAML)");
        kc = this.buildKubeConfigFromString();
      } else {
        // Priority 2: In-cluster mode
        const inClusterCandidates = [
          "/var/run/secrets/kubernetes.io/serviceaccount/token",
          "/run/secrets/kubernetes.io/serviceaccount/token",
        ];
        const hasSa = inClusterCandidates.some((p) => {
          try {
            return fs.existsSync(p);
          } catch {
            return false;
          }
        });
        if (env.SANDBOX_K8S_IN_CLUSTER === "true" || hasSa) {
          this.dbg("loadClient: using in-cluster configuration");
          kc = new KubeConfig();
          kc.loadFromCluster();
          // Auto-detect namespace from serviceaccount if not provided
          if (!this.opts.namespace) {
            try {
              const nsPathCandidates = [
                "/var/run/secrets/kubernetes.io/serviceaccount/namespace",
                "/run/secrets/kubernetes.io/serviceaccount/namespace",
              ];
              for (const p of nsPathCandidates) {
                if (fs.existsSync(p)) {
                  const ns = fs.readFileSync(p, "utf8").trim();
                  if (ns) (this.opts as { namespace: string }).namespace = ns;
                  break;
                }
              }
            } catch {}
          }
        } else {
          // Priority 3: Default kubeconfig
          this.dbg("loadClient: using default kubeconfig (~/.kube/config)");
          kc = new KubeConfig();
          kc.loadFromDefault();
        }
      }
    } catch (e) {
      throw new Error(`Failed loading kubeconfig: ${(e as Error).message}`);
    }
    if (!kc) {
      throw new Error("Failed to initialize Kubernetes client - kubeconfig not loaded");
    }
    // If still no namespace, derive on demand via resolveNamespace()
    this.kc = kc;
    this.core = kc.makeApiClient(CoreV1Api);
    // Store in singleton cache
    k8sClientCache.set(cacheKey, { kc: this.kc, core: this.core, createdAt: Date.now() });
    this.dbg("loadClient: client initialized and cached");
    // Ensure namespace resolved and stored for subsequent calls
    try {
      const ns = await this.resolveNamespace();
      this.dbg("loadClient: resolved namespace=", ns || "(empty)");
      if (ns) (this.opts as { namespace: string }).namespace = ns;
    } catch {}
    // Exec used directly when needed
  }

  /** Find an existing managed sandbox pod name (Running/Pending) matching the sandboxId. */
  private async findExistingPodName(): Promise<string | undefined> {
    // Only reuse if a specific sandboxId is requested
    if (!this.opts.sandboxId) return undefined;

    if (!this.core) await this.loadClient();
    const core = this.core as ICoreV1Api;
    const ns = await this.resolveNamespace();
    try {
      // Build label selector with sandbox-id
      // We strictly match by sandbox-id for reuse
      const labelSelector = `app=sandbox,managed-by=${this.managedByLabelValue},sandbox-id=${this.opts.sandboxId}`;

      // Wrap with a 5s timeout to prevent API Server slowness from blocking callers
      const listPromise = core.listNamespacedPod({
        namespace: ns,
        labelSelector,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("findExistingPodName: K8s API timeout (5s)")), 5_000),
      );
      const list = await Promise.race([listPromise, timeoutPromise]);
      const pods = ((
        list as unknown as {
          body?: {
            items?: Array<{
              metadata?: { name?: string; creationTimestamp?: string };
              status?: { phase?: string };
            }>;
          };
        }
      ).body?.items ||
        (
          list as unknown as {
            items?: Array<{
              metadata?: { name?: string; creationTimestamp?: string };
              status?: { phase?: string };
            }>;
          }
        ).items ||
        []) as Array<{
        metadata?: { name?: string; creationTimestamp?: string };
        status?: { phase?: string };
      }>;
      const candidates = pods
        .filter(
          (p) =>
            p.status?.phase !== "Succeeded" &&
            p.status?.phase !== "Failed" &&
            (p.metadata?.name || "").startsWith("sandbox-"),
        )
        .sort((a, b) => {
          const at = Date.parse(a.metadata?.creationTimestamp || "0");
          const bt = Date.parse(b.metadata?.creationTimestamp || "0");
          return bt - at;
        });
      return candidates[0]?.metadata?.name;
    } catch {
      return undefined;
    }
  }

  /** Derive a conservative CPU request from limit (10% floor 10m). */
  private deriveCpuRequest(limit: string): string {
    const v = limit.trim();
    let cores: number;
    if (v.endsWith("m")) {
      const n = Number(v.slice(0, -1));
      cores = Number.isFinite(n) ? n / 1000 : 0.1;
    } else {
      const n = Number(v);
      cores = Number.isFinite(n) ? n : 0.1;
    }
    const req = Math.min(Math.max(cores * 0.1, 0.01), 0.05); // 10m–50m
    const milli = Math.round(req * 1000);
    return milli < 1000 ? `${milli}m` : `${(milli / 1000).toFixed(3).replace(/\.000$/, "")}`;
  }

  /**
   * Build KubeConfig from SANDBOX_K8S_KUBECONFIG_BASE64 or SANDBOX_K8S_KUBECONFIG_YAML.
   * This allows users to paste their entire kubeconfig as a single environment variable.
   */
  private buildKubeConfigFromString(): KubeConfig {
    const env = process.env;
    let kubeconfigYaml: string;

    // Priority 1: BASE64 encoded kubeconfig (recommended for env vars)
    if (env.SANDBOX_K8S_KUBECONFIG_BASE64) {
      try {
        kubeconfigYaml = Buffer.from(env.SANDBOX_K8S_KUBECONFIG_BASE64, "base64").toString("utf-8");
      } catch (e) {
        throw new Error(`Failed to decode SANDBOX_K8S_KUBECONFIG_BASE64: ${(e as Error).message}`);
      }
    }
    // Priority 2: Plain YAML with escaped newlines
    else if (env.SANDBOX_K8S_KUBECONFIG_YAML) {
      // Replace escaped newlines (\n) with actual newlines
      kubeconfigYaml = env.SANDBOX_K8S_KUBECONFIG_YAML.replace(/\\n/g, "\n");
    } else {
      throw new Error(
        "Neither SANDBOX_K8S_KUBECONFIG_BASE64 nor SANDBOX_K8S_KUBECONFIG_YAML is set",
      );
    }

    // Parse and load the kubeconfig
    const kc = new KubeConfig();
    try {
      kc.loadFromString(kubeconfigYaml);
    } catch (e) {
      throw new Error(`Failed to parse kubeconfig YAML: ${(e as Error).message}`);
    }

    return kc;
  }

  // NOTE: Deprecated createPVC and deletePVC methods removed - now using volumes system

  async start(): Promise<string | undefined> {
    if (this.started) return this.podName;
    await this.loadClient();
    // Use sandboxId for explicit reuse if provided
    const existing = await this.findExistingPodName();
    if (existing) {
      this.dbg("start: reusing existing pod", existing);
      this.podName = existing;
      this.started = true;
      return this.podName;
    }
    this.podName = this.opts.podName ?? `sandbox-${randomUUID().slice(0, 8)}`;
    this.dbg("start: creating pod", this.podName);

    const ns = await this.resolveNamespace();

    // NOTE: Old persistence system removed - now using volumes system
    // Create PVC if persistence is enabled
    // if (this.opts.persistentStorage?.enabled && this.opts.persistentStorage.volumeName) {
    //   await this.createPVC(this.opts.persistentStorage.volumeName, ns);
    // }

    // Build labels with optional space-id and image
    const labels: Record<string, string> = {
      app: "sandbox",
      "managed-by": this.managedByLabelValue,
    };
    if (this.opts.spaceId) {
      labels["space-id"] = this.opts.spaceId;
    }
    if (this.opts.sandboxId) {
      labels["sandbox-id"] = this.opts.sandboxId;
    }
    if (this.opts.image) {
      labels.image = this.sanitizeImageForLabel(this.opts.image);
    }

    // Build volume mounts — all volumes use subPath isolation on shared PVCs
    // S3 volumes use SANDBOX_K8S_PVC_NAME, EBS volumes use their assigned pvcName from the pool
    const sharedPvcName = process.env.SANDBOX_K8S_PVC_NAME || "pvc-data";

    const podVolumes: Array<{ name: string; persistentVolumeClaim: { claimName: string } }> = [];
    const containerVolumeMounts: Array<{
      name: string;
      mountPath: string;
      subPath?: string;
      readOnly: boolean;
    }> = [];
    // Track which PVCs are already added to avoid duplicates
    const addedPvcs = new Map<string, string>(); // claimName -> volumeName

    const getOrAddPvc = (claimName: string, prefix: string): string => {
      const existing = addedPvcs.get(claimName);
      if (existing) return existing;
      const volName = `${prefix}-${claimName}`;
      podVolumes.push({ name: volName, persistentVolumeClaim: { claimName } });
      addedPvcs.set(claimName, volName);
      return volName;
    };

    for (const m of this.opts.volumeMounts) {
      if (m.storageType === "ebs" && m.pvcName) {
        // EBS: subPath on the assigned EBS PVC from pool
        const volName = getOrAddPvc(m.pvcName, "ebs");
        containerVolumeMounts.push({
          name: volName,
          mountPath: m.target,
          subPath: m.source,
          readOnly: m.readOnly ?? false,
        });
      } else {
        // S3/default: subPath on shared PVC
        const volName = getOrAddPvc(sharedPvcName, "shared");
        containerVolumeMounts.push({
          name: volName,
          mountPath: m.target,
          subPath: m.source,
          readOnly: m.readOnly ?? false,
        });
      }
    }

    // Resolve node affinity for EBS PVCs: always read PVC annotation volume.kubernetes.io/selected-node to handle node changes
    let resolvedNodeName = this.opts.nodeName;
    for (const m of this.opts.volumeMounts) {
      if (m.storageType === "ebs" && m.pvcName) {
        try {
          const pvc = await (this.core as ICoreV1Api).readNamespacedPersistentVolumeClaim({
            name: m.pvcName,
            namespace: ns,
          });
          const pvcObj = ((pvc as unknown as { body?: unknown }).body ?? pvc) as {
            metadata?: { annotations?: Record<string, string> };
          };
          const selectedNode =
            pvcObj?.metadata?.annotations?.["volume.kubernetes.io/selected-node"];
          if (selectedNode) {
            resolvedNodeName = selectedNode;
            this.dbg("start: EBS PVC", m.pvcName, "bound to node", selectedNode);
            break;
          }
        } catch (e) {
          this.dbg("start: failed to read PVC", m.pvcName, e);
        }
      }
    }

    const spec: V1Pod = {
      metadata: {
        name: this.podName,
        labels,
        // Disable EKS Pod Identity injection for security
        // This prevents AWS credential injection and volume mounts
        annotations: {
          "eks.amazonaws.com/disable-pod-identity": "true",
        },
      },
      spec: {
        hostname: this.podName,
        subdomain: "sandbox-headless",
        // EBS affinity: use nodeSelector to schedule Pod to the node where PVC is bound
        nodeSelector: resolvedNodeName ? { "kubernetes.io/hostname": resolvedNodeName } : undefined,
        serviceAccountName: this.opts.serviceAccountName || undefined,
        // Disable automatic mounting of service account tokens for security
        automountServiceAccountToken: false,
        // Disable automatic injection of Kubernetes service environment variables
        // This prevents variables like KUBERNETES_*, OPENRESTY_PORT, etc. from being visible
        enableServiceLinks: false,
        restartPolicy: "Never",
        // Speed up shutdown so delete operations don't linger
        terminationGracePeriodSeconds: 0,
        // Add activeDeadlineSeconds if specified (max runtime limit)
        activeDeadlineSeconds: this.opts.activeDeadlineSeconds,
        imagePullSecrets: (this.opts.imagePullSecrets || []).length
          ? this.opts.imagePullSecrets.map((name) => ({ name }))
          : undefined,
        volumes: podVolumes.length > 0 ? podVolumes : undefined,
        containers: [
          {
            name: "main",
            image: this.opts.image,
            imagePullPolicy: this.opts.pullPolicy,
            // Use custom command if provided, otherwise use default sleep command
            command: this.opts.command ?? [
              "sh",
              "-lc",
              `mkdir -p ${this.opts.workdir} && sleep ${this.opts.idleSeconds}`,
            ],
            workingDir: this.opts.workdir,
            // Set environment variables if provided
            env: this.opts.env
              ? Object.entries(this.opts.env).map(([name, value]) => ({ name, value }))
              : undefined,
            resources: {
              limits: { memory: `${this.opts.memoryLimitMb}Mi`, cpu: this.opts.cpuLimit },
              // Requests: 25% of limit, clamped between 64Mi and 200Mi memory, and CPU between 10m and 50m
              requests: {
                memory: `${Math.min(Math.max(64, Math.floor(this.opts.memoryLimitMb * 0.25)), 200)}Mi`,
                cpu: this.deriveCpuRequest(this.opts.cpuLimit),
              },
            },
            volumeMounts: containerVolumeMounts.length > 0 ? containerVolumeMounts : undefined,
          },
        ],
      },
    };
    try {
      if (!this.core) throw new Error("Core API not initialized");
      this.dbg("start: createNamespacedPod in ns=", ns);
      await this.core.createNamespacedPod({ namespace: ns, body: spec });
    } catch (e: unknown) {
      if ((e as { body?: { reason?: string } })?.body?.reason !== "AlreadyExists") throw e;
    }
    // Wait until running
    const maxWait = Date.now() + 60_000;
    let lastPhase: string | undefined;
    let lastReason: string | undefined;
    let lastMessage: string | undefined;
    this.dbg("start: waiting for pod to be Running (up to 20s)");
    while (Date.now() < maxWait) {
      try {
        if (!this.core) throw new Error("Core API not initialized");
        const resp = (await this.core.readNamespacedPod({
          name: this.podName,
          namespace: await this.resolveNamespace(),
        })) as unknown;
        // Support either V1Pod or { body: V1Pod }
        const podObj = (
          resp && (resp as { body?: unknown }).body
            ? (
                resp as {
                  body: {
                    status?: {
                      phase?: string;
                      conditions?: Array<{
                        type?: string;
                        status?: string;
                        reason?: string;
                        message?: string;
                      }>;
                    };
                  };
                }
              ).body
            : (resp as {
                status?: {
                  phase?: string;
                  conditions?: Array<{
                    type?: string;
                    status?: string;
                    reason?: string;
                    message?: string;
                  }>;
                };
              })
        ) as {
          status?: {
            phase?: string;
            conditions?: Array<{
              type?: string;
              status?: string;
              reason?: string;
              message?: string;
            }>;
          };
        };
        const phase = podObj?.status?.phase;
        if (phase && phase !== lastPhase) {
          this.dbg("start: pod phase=", phase);
        }
        lastPhase = phase || lastPhase;
        const cond =
          podObj?.status?.conditions?.find((c) => c?.type === "ContainersReady") ||
          podObj?.status?.conditions?.[0];
        lastReason = cond?.reason || lastReason;
        lastMessage = cond?.message || lastMessage;
        if (phase === "Running") {
          this.started = true;
          // Capture the actual node the Pod was scheduled to
          const specObj = (
            resp && (resp as { body?: unknown }).body
              ? (resp as { body: { spec?: { nodeName?: string } } }).body
              : (resp as { spec?: { nodeName?: string } })
          ) as { spec?: { nodeName?: string } };
          this.scheduledNodeName = specObj?.spec?.nodeName ?? undefined;
          this.dbg("start: pod is Running on node=", this.scheduledNodeName);
          return this.podName;
        }
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    const details = [
      `phase=${lastPhase || "unknown"}`,
      lastReason ? `reason=${lastReason}` : "",
      lastMessage ? `message=${lastMessage}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    this.dbg("start: timeout waiting for Running", details);
    throw new Error(`Pod did not reach Running state${details ? ` (${details})` : ""}`);
  }

  /** Return the node the Pod was actually scheduled to (available after start()) */
  getScheduledNode(): string | undefined {
    return this.scheduledNodeName;
  }

  /**
   * Return cluster-internal DNS for this pod via headless service.
   * Format: <podName>.sandbox-headless.<namespace>.svc.cluster.local
   */
  getInternalHost(): string {
    const pod = this.ensureStarted();
    const ns = this._resolvedNs ?? this.opts.namespace ?? "default";
    return `${pod}.sandbox-headless.${ns}.svc.cluster.local`;
  }

  async stop(): Promise<void> {
    // Allow deletion even if this provider wasn't the one that started the pod
    let targets: string[] = [];
    if (this.podName) targets.push(this.podName);
    if (this.opts.podName && !targets.includes(this.opts.podName)) targets.push(this.opts.podName);
    try {
      if (!this.core) await this.loadClient();
      const core = this.core as ICoreV1Api;
      const ns = await this.resolveNamespace();
      this.dbg("stop: resolving pods to delete in ns=", ns);
      // If no explicit targets, resolve the newest existing managed sandbox pod
      if (targets.length === 0) {
        const newest = await this.findExistingPodName();
        if (newest) targets.push(newest);
      }
      // As a last resort, list app=sandbox pods and pick those with sandbox-* prefix
      if (targets.length === 0) {
        try {
          // Build label selector with spaceId and image filter if provided
          let labelSelector = "app=sandbox";
          if (this.opts.spaceId) {
            labelSelector += `,space-id=${this.opts.spaceId}`;
          }
          if (this.opts.image) {
            const imageLabel = this.sanitizeImageForLabel(this.opts.image);
            labelSelector += `,image=${imageLabel}`;
          }
          const list = await core.listNamespacedPod({
            namespace: ns,
            labelSelector,
          });
          const items = ((
            list as unknown as { body?: { items?: Array<{ metadata?: { name?: string } }> } }
          ).body?.items ||
            (list as unknown as { items?: Array<{ metadata?: { name?: string } }> }).items ||
            []) as Array<{
            metadata?: { name?: string };
          }>;
          targets = items
            .map((p) => p.metadata?.name || "")
            .filter((n) => n.startsWith("sandbox-"));
        } catch {
          // ignore list errors
        }
      }
      if (targets.length === 0) return; // nothing to delete
      // Request immediate deletion and background propagation to avoid orphaning
      for (const name of Array.from(new Set(targets))) {
        try {
          this.dbg("stop: deleteNamespacedPod", name);
          await core.deleteNamespacedPod({
            name,
            namespace: ns,
            gracePeriodSeconds: 0,
            propagationPolicy: "Background",
          });
        } catch (_e) {
          // continue to wait; if already gone this will surface as 404 below
        }
        // Actively wait until the Pod resource is gone (404), up to 10s per pod
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          try {
            await core.readNamespacedPod({ name, namespace: ns });
            await new Promise((r) => setTimeout(r, 300));
          } catch (e: unknown) {
            const statusCode =
              (e as { response?: { statusCode?: number } })?.response?.statusCode ??
              (e as { statusCode?: number })?.statusCode ??
              (e as { body?: { code?: number } })?.body?.code;
            if (statusCode === 404) break; // deleted
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }
    } catch (e) {
      // Surface error context for the caller/UI
      throw new Error(`Failed to delete sandbox pod: ${(e as Error).message}`);
    }
    this.started = false;
    this.podName = undefined;
    // NOTE: PVC is NOT deleted here - it persists for pause/resume
    // Use delete() method to permanently delete sandbox and its PVC
  }

  /**
   * Permanently delete sandbox resources including PVC.
   * This is different from stop() which preserves PVC for pause/resume.
   */
  async delete(): Promise<void> {
    // First stop the pod
    await this.stop();

    // NOTE: Old persistence system removed - now using volumes
    // Then delete the PVC if persistence is enabled
    // if (this.opts.persistentStorage?.enabled && this.opts.persistentStorage.volumeName) {
    //   try {
    //     if (!this.core) await this.loadClient();
    //     const ns = await this.resolveNamespace();
    //     await this.deletePVC(this.opts.persistentStorage.volumeName, ns);
    //   } catch (e) {
    //     this.dbg("delete: failed to delete PVC", e);
    //     throw new Error(`Failed to delete PVC: ${(e as Error).message}`);
    //   }
    // }
  }

  private ensureStarted() {
    if (!this.started || !this.podName) throw new Error("Sandbox not started");
    return this.podName;
  }

  /**
   * Lightweight health check: verify pod is still Running before exec.
   * Uses a short 3s timeout. Throws if the pod is Terminating/Failed/Gone.
   * Result is cached for 5 seconds to avoid excessive API calls.
   */
  private _lastHealthCheck = 0;
  private async ensurePodReady(podName: string): Promise<void> {
    const now = Date.now();
    // Skip if checked recently (within 5s)
    if (now - this._lastHealthCheck < 5_000) return;

    if (!this.core) return; // no client yet, will fail elsewhere
    const ns = await this.resolveNamespace();
    try {
      const readPromise = this.core.readNamespacedPod({ name: podName, namespace: ns });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ensurePodReady: K8s API timeout (3s)")), 3_000),
      );
      const resp = await Promise.race([readPromise, timeoutPromise]);
      const podObj = (
        resp && (resp as { body?: unknown }).body
          ? (resp as { body: { status?: { phase?: string } } }).body
          : (resp as { status?: { phase?: string } })
      ) as { status?: { phase?: string }; metadata?: { deletionTimestamp?: string } };
      const phase = podObj?.status?.phase;
      const deleting = podObj?.metadata?.deletionTimestamp;
      if (phase === "Failed" || phase === "Succeeded" || deleting) {
        throw new Error(
          `Pod ${podName} is not ready (phase=${phase}${deleting ? ", deletionTimestamp set" : ""})`,
        );
      }
      this._lastHealthCheck = now;
    } catch (e) {
      const statusCode =
        (e as { response?: { statusCode?: number } })?.response?.statusCode ??
        (e as { statusCode?: number })?.statusCode ??
        (e as { body?: { code?: number } })?.body?.code;
      if (statusCode === 404) {
        throw new Error(`Pod ${podName} not found (404) — sandbox may have been deleted`);
      }
      // For timeout or other transient errors, log but don't block
      this.dbg("ensurePodReady: check failed (non-blocking)", (e as Error).message);
    }
  }

  private async execCommand(
    cmd: string,
    opts: { timeoutMs?: number; input?: string } = {},
  ): Promise<SandboxExecutionResult> {
    await this.start();
    const pod = this.ensureStarted();
    if (!this.kc) throw new Error("KubeConfig not loaded");
    this.dbg("execCommand:", {
      ns: await this.resolveNamespace(),
      pod,
      cmd: cmd.length > 200 ? `${cmd.slice(0, 200)}…` : cmd,
      timeoutMs: opts.timeoutMs,
    });

    // --- Health check: verify pod is reachable before running command ---
    await this.ensurePodReady(pod);

    const exec = new Exec(this.kc);
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    stdoutStream.on("data", (d: unknown) => stdoutChunks.push(String(d)));
    stderrStream.on("data", (d: unknown) => stderrChunks.push(String(d)));
    const { timeoutMs = 10_000 } = opts;
    const start = Date.now();
    let timedOut = false;
    let exitCode: number | null = null;

    // Create stdin stream if input provided
    // IMPORTANT: Must end the stream after writing to signal EOF to commands like `cat >`
    let stdin: Readable | undefined;
    if (opts.input != null) {
      stdin = new PassThrough();
      stdin.push(opts.input);
      stdin.push(null); // Signal EOF immediately after data
    }

    const commandArr = ["sh", "-lc", cmd];
    const ns = await this.resolveNamespace();
    await new Promise<void>((resolve) => {
      let resolved = false;
      const to = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
        timedOut = true;
        this.dbg("execCommand: timeout hit, killing process", {
          cmd: cmd.slice(0, 100),
          timeoutMs,
        });

        // Try to kill the process in the pod (fire and forget, do not await to avoid hanging the timeout itself)
        try {
          if (!this.kc) throw new Error("KubeConfig not available");
          const killExec = new Exec(this.kc);
          const dummyStream = new PassThrough();
          killExec
            .exec(
              ns,
              pod,
              "main",
              ["sh", "-c", "pkill -9 -f 'sh -lc'"],
              dummyStream,
              dummyStream,
              undefined as unknown as Readable,
              false,
              () => {
                // Ignore callback, just kill
              },
            )
            .catch((err) => {
              this.dbg("execCommand: kill process failed in background", err);
            });
          exitCode = 137;
        } catch (err) {
          this.dbg("execCommand: failed to kill process on timeout", err);
          exitCode = 124; // timeout command exit code
        }

        resolve();
      }, timeoutMs as number);
      exec
        .exec(
          ns,
          pod,
          "main",
          commandArr,
          stdoutStream,
          stderrStream,
          stdin as unknown as Readable,
          false,
          (status: unknown) => {
            if (resolved) return; // Don't process if already timed out
            resolved = true;
            clearTimeout(to);
            this.dbg("execCommand: status callback", { status });

            // Kubernetes exec status callback returns: { metadata: {}, status: 'Success'|'Failure' }
            // Not a numeric exit code, so we map Success->0, anything else->1
            if (status && typeof (status as { status?: string }).status === "string") {
              const statusStr = (status as { status: string }).status;
              exitCode = statusStr === "Success" ? 0 : 1;
              this.dbg("execCommand: mapped status to exitCode", { statusStr, exitCode });
            } else if (status && typeof (status as { exitCode?: number }).exitCode === "number") {
              // Fallback for other possible formats
              exitCode = (status as { exitCode: number }).exitCode;
            } else if (status && typeof (status as { code?: number }).code === "number") {
              exitCode = (status as { code: number }).code;
            } else {
              // If command completed without error and we got callback, assume success
              this.dbg("execCommand: no recognizable exit code, defaulting to 0");
              assert("execCommand: unrecognized status callback format");
              exitCode = 0;
            }
            resolve();
          },
        )
        .catch((err: unknown) => {
          if (resolved) return; // Don't process if already timed out
          resolved = true;
          clearTimeout(to);
          const errMsg = err instanceof Error ? err.message : String(err);
          // Enhanced error logging: distinguish connection failures from command failures
          const isConnectionError =
            errMsg.includes("ECONNREFUSED") ||
            errMsg.includes("ECONNRESET") ||
            errMsg.includes("ETIMEDOUT") ||
            errMsg.includes("socket hang up") ||
            errMsg.includes("WebSocket") ||
            errMsg.includes("EHOSTUNREACH");
          if (isConnectionError) {
            stderrChunks.push(`[K8S_CONNECTION_ERROR] ${errMsg}`);
            this.dbg("execCommand: K8s connection error (pod may be unreachable)", errMsg);
          } else {
            stderrChunks.push(errMsg);
            this.dbg("execCommand: exec error", errMsg, err);
          }
          exitCode = 1;
          resolve();
        });
    });
    this.dbg("execCommand: done", { exitCode, timedOut, durationMs: Date.now() - start });
    return {
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
      exitCode,
      timedOut,
      durationMs: Date.now() - start,
    };
  }

  async writeFile(opts: SandboxFsWriteOptions): Promise<void> {
    const data =
      typeof opts.content === "string" ? opts.content : Buffer.from(opts.content).toString("utf8");

    // Resolve absolute path: if relative, prepend workdir
    const absolutePath = opts.path.startsWith("/")
      ? opts.path
      : `${this.opts.workdir}/${opts.path}`;

    const quotedPath = this.quotePath(absolutePath);
    const mode = opts.executable ? "755" : "644";

    const b64 = Buffer.from(data).toString("base64");
    const chunkSize = 50_000; // 50KB base64 threshold — fits in single K8s exec URL

    if (b64.length <= chunkSize) {
      // Small file: single base64 exec (fast, no overhead)
      await this.execCommand(
        `dir=$(dirname ${quotedPath}) && mkdir -p "$dir" && printf '%s' '${b64}' | base64 -d > ${quotedPath} && chmod ${mode} ${quotedPath}`,
        { timeoutMs: 30_000 },
      );
    } else {
      // Large file: tar stream via exec stdin (1 call, no base64 bloat)
      await this.writeFileViaTar(absolutePath, Buffer.from(data), opts.executable ? 0o755 : 0o644);
    }
  }

  /**
   * Write a large file into the pod via `tar xf -` piped through exec stdin.
   *
   * K8s exec has a known issue: after stdin EOF, neither the status callback
   * nor stdout data is reliably delivered (WebSocket EOF handling varies across
   * K8s versions/protocols). So we:
   *   1. Fire the tar write (don't wait for its status callback)
   *   2. Poll with a separate lightweight exec to verify the file landed
   */
  private async writeFileViaTar(
    absolutePath: string,
    dataBuffer: Buffer,
    mode: number,
  ): Promise<void> {
    await this.start();
    const pod = this.ensureStarted();
    if (!this.kc) throw new Error("KubeConfig not loaded");
    await this.ensurePodReady(pod);

    const lastSlash = absolutePath.lastIndexOf("/");
    const targetDir = lastSlash > 0 ? absolutePath.substring(0, lastSlash) : "/";
    const filename = lastSlash >= 0 ? absolutePath.substring(lastSlash + 1) : absolutePath;

    // Build tar archive in memory
    const tarBuf = await packTarEntry(filename, dataBuffer, mode);

    // Ensure target directory exists
    await this.execCommand(`mkdir -p '${targetDir}'`, { timeoutMs: 10_000 });

    // Fire tar write — stdin EOF won't reliably trigger status callback,
    // so we just wait for the data to be sent and give tar time to extract.
    const exec = new Exec(this.kc);
    const ns = await this.resolveNamespace();
    const stdinStream = new PassThrough();
    const nullStream = new PassThrough();
    nullStream.resume(); // drain stdout/stderr

    const conn = await exec.exec(
      ns,
      pod,
      "main",
      ["tar", "xf", "-", "-C", targetDir],
      nullStream,
      nullStream,
      stdinStream as unknown as Readable,
      false,
      () => {}, // status callback unreliable — ignore
    );

    // Send tar data and signal EOF
    stdinStream.end(tarBuf);

    // Poll: verify file exists and has expected size via a separate exec
    const expectedSize = dataBuffer.length;
    const quotedPath = this.quotePath(absolutePath);
    const maxWaitMs = 30_000;
    const pollIntervalMs = 200;
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const res = await this.execCommand(`stat -c '%s' ${quotedPath} 2>/dev/null || echo -1`, {
        timeoutMs: 5_000,
      });
      const size = Number.parseInt(res.stdout.trim(), 10);
      if (size === expectedSize) {
        // File fully written — set permissions and return
        const modeStr = mode === 0o755 ? "755" : "644";
        await this.execCommand(`chmod ${modeStr} ${quotedPath}`, { timeoutMs: 5_000 });
        // Clean up WebSocket if still open
        try {
          (conn as unknown as { close?: () => void })?.close?.();
        } catch {}
        return;
      }
    }

    try {
      (conn as unknown as { close?: () => void })?.close?.();
    } catch {}
    throw new Error(
      `writeFileViaTar: file size mismatch after ${maxWaitMs}ms (expected ${expectedSize})`,
    );
  }

  async readFile(path: string): Promise<string> {
    // Resolve absolute path: if relative, prepend workdir
    const absolutePath = path.startsWith("/") ? path : `${this.opts.workdir}/${path}`;

    const res = await this.execCommand(`cat ${this.quotePath(absolutePath)}`);
    return res.stdout;
  }

  async list(path = "."): Promise<string[]> {
    // Resolve absolute path: if relative, prepend workdir
    const absolutePath =
      path === "." || path === ""
        ? this.opts.workdir
        : path.startsWith("/")
          ? path
          : `${this.opts.workdir}/${path}`;

    const res = await this.execCommand(`ls -1 ${this.quotePath(absolutePath)}`);
    return res.stdout.split("\n").filter(Boolean);
  }

  async remove(path: string): Promise<void> {
    // Resolve absolute path: if relative, prepend workdir
    const absolutePath = path.startsWith("/") ? path : `${this.opts.workdir}/${path}`;

    await this.execCommand(`rm -rf ${this.quotePath(absolutePath)}`);
  }

  async shell(opts: SandboxShellOptions): Promise<SandboxExecutionResult> {
    const cmdStr = Array.isArray(opts.cmd) ? opts.cmd.join(" ") : opts.cmd;
    const workdir = opts.workdir ?? this.opts.workdir;
    // K8s exec known issue: stdin via WebSocket prevents status callback from
    // firing reliably (see writeFileViaTar comment). Pipe input through the
    // shell command itself to avoid the broken stdin channel.
    const innerCmd = opts.input
      ? `printf '%s' '${opts.input.replace(/'/g, "'\\''")}' | ${cmdStr}`
      : cmdStr;
    const baseCmd = `cd ${this.quotePath(workdir)} && ${innerCmd}`;
    const full =
      opts.env && Object.keys(opts.env).length > 0
        ? buildEnvShellSnippet(opts.env, baseCmd)
        : baseCmd;
    return this.execCommand(full, { timeoutMs: opts.timeoutMs });
  }

  async runCode(options: SandboxCodeOptions): Promise<SandboxExecutionResult> {
    const filename = `snippet-${randomUUID().slice(0, 8)}.${
      options.language === "python" ? "py" : options.language === "typescript" ? "ts" : "js"
    }`;
    // Use relative path - writeFile will prepend workdir
    await this.writeFile({ path: filename, content: options.code });
    let cmd: string;
    switch (options.language) {
      case "javascript":
        cmd = `node ${filename}`;
        break;
      case "typescript":
        cmd = `tsx ${filename}`;
        break;
      case "python":
        cmd = `python ${filename}`;
        break;
      default:
        throw new Error("Unsupported language");
    }
    return this.shell({ cmd, timeoutMs: options.timeoutMs, env: options.env });
  }

  /**
   * Stream shell command execution with real-time output.
   * Uses Kubernetes exec API with streaming.
   */
  async *shellStream(opts: SandboxShellOptions): AsyncIterable<StreamEvent> {
    await this.start();
    const pod = this.ensureStarted();
    if (!this.kc) throw new Error("KubeConfig not loaded");

    const cmdStr = Array.isArray(opts.cmd) ? opts.cmd.join(" ") : opts.cmd;
    const workdir = opts.workdir ?? this.opts.workdir;
    // K8s exec known issue: stdin via WebSocket prevents status callback from
    // firing reliably. Pipe input through the shell command itself.
    const innerCmd = opts.input
      ? `printf '%s' '${opts.input.replace(/'/g, "'\\''")}' | ${cmdStr}`
      : cmdStr;
    const baseCmd = `cd ${this.quotePath(workdir)} && ${innerCmd}`;
    const fullCmd =
      opts.env && Object.keys(opts.env).length > 0
        ? buildEnvShellSnippet(opts.env, baseCmd)
        : baseCmd;
    const commandArr = ["sh", "-lc", fullCmd];

    const ns = await this.resolveNamespace();
    const exec = new Exec(this.kc);
    const start = Date.now();
    const timeoutMs = opts.timeoutMs ?? 10_000;
    let timedOut = false;
    let exitCode: number | null = null;

    // Async queue pattern for real-time streaming
    const eventQueue: Array<StreamEvent | { type: "done" }> = [];
    let waitingResolve: (() => void) | null = null;

    const pushEvent = (event: StreamEvent | { type: "done" }) => {
      eventQueue.push(event);
      if (waitingResolve) {
        waitingResolve();
        waitingResolve = null;
      }
    };

    // Create streams for stdout/stderr
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    // Handle real-time data events
    stdoutStream.on("data", (d: unknown) => pushEvent({ type: "stdout", data: String(d) }));
    stderrStream.on("data", (d: unknown) => pushEvent({ type: "stderr", data: String(d) }));

    // Start execution
    const execPromise = new Promise<void>((resolve) => {
      let resolved = false;

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        timedOut = true;
        this.dbg("shellStream: timeout hit", { cmd: cmdStr, timeoutMs });

        // Try to kill the process (fire and forget)
        try {
          if (!this.kc) throw new Error("KubeConfig not available");
          const killExec = new Exec(this.kc);
          const dummyStream = new PassThrough();
          killExec
            .exec(
              ns,
              pod,
              "main",
              ["sh", "-c", "pkill -9 -f 'sh -lc'"],
              dummyStream,
              dummyStream,
              undefined as unknown as Readable,
              false,
              () => {},
            )
            .catch(() => {});
          exitCode = 137;
        } catch {
          exitCode = 124;
        }

        pushEvent({ type: "done" });
        resolve();
      }, timeoutMs);

      exec
        .exec(
          ns,
          pod,
          "main",
          commandArr,
          stdoutStream,
          stderrStream,
          undefined as unknown as Readable,
          false,
          (status: unknown) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutHandle);

            // Parse exit status
            if (status && typeof (status as { status?: string }).status === "string") {
              const statusStr = (status as { status: string }).status;
              exitCode = statusStr === "Success" ? 0 : 1;
            } else if (status && typeof (status as { exitCode?: number }).exitCode === "number") {
              exitCode = (status as { exitCode: number }).exitCode;
            } else if (status && typeof (status as { code?: number }).code === "number") {
              exitCode = (status as { code: number }).code;
            } else {
              exitCode = 0;
            }

            pushEvent({ type: "done" });
            resolve();
          },
        )
        .catch((err: unknown) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutHandle);
          const errMsg =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : JSON.stringify(err) || "Unknown error";
          pushEvent({ type: "error", message: errMsg });
          exitCode = 1;
          pushEvent({ type: "done" });
          resolve();
        });
    });

    // Yield events as they arrive
    try {
      while (true) {
        if (eventQueue.length === 0) {
          await new Promise<void>((resolve) => {
            waitingResolve = resolve;
          });
        }
        const event = eventQueue.shift();
        if (!event || event.type === "done") break;
        yield event as StreamEvent;
      }
      await execPromise;
    } catch {
      // Ensure we don't leak
    }

    yield {
      type: "exit",
      exitCode,
      timedOut,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Stream code execution with real-time output.
   */
  async *runCodeStream(options: SandboxCodeOptions): AsyncIterable<StreamEvent> {
    const filename = `snippet-${randomUUID().slice(0, 8)}.${
      options.language === "python" ? "py" : options.language === "typescript" ? "ts" : "js"
    }`;
    // Use relative path - writeFile will prepend workdir
    await this.writeFile({ path: filename, content: options.code });
    let cmd: string;
    switch (options.language) {
      case "javascript":
        cmd = `node ${filename}`;
        break;
      case "typescript":
        cmd = `tsx ${filename}`;
        break;
      case "python":
        cmd = `python ${filename}`;
        break;
      default:
        throw new Error("Unsupported language");
    }
    // Use shellStream for real-time output
    for await (const event of this.shellStream({
      cmd,
      timeoutMs: options.timeoutMs,
      input: options.input,
      env: options.env,
    })) {
      yield event;
    }
  }

  private quotePath(p: string): string {
    if (p === "." || p === "") return p;
    return `'${p.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Get volume size in bytes using du command
   * @param volumePath - Absolute path to the volume directory
   * @returns Size in bytes
   */
  async getVolumeSize(volumePath: string): Promise<number> {
    try {
      await this.start();
      // Use du -sb to get size in bytes, cut to extract just the number
      const result = await this.execCommand(
        `du -sb ${this.quotePath(volumePath)} 2>/dev/null | cut -f1 || echo 0`,
        { timeoutMs: 30_000 },
      );
      const sizeStr = result.stdout.trim();
      const size = Number.parseInt(sizeStr, 10);
      return Number.isFinite(size) && size >= 0 ? size : 0;
    } catch (e) {
      this.dbg("getVolumeSize: error calculating size", e);
      return 0;
    }
  }
  async createPtySession(opts: PtySessionOptions): Promise<PtySession> {
    await this.start();
    const pod = this.ensureStarted();
    if (!this.kc) throw new Error("KubeConfig not loaded");

    const id = randomUUID().slice(0, 8);
    const ns = await this.resolveNamespace();
    const exec = new Exec(this.kc);

    const initialCols = opts.cols ?? 80;
    const initialRows = opts.rows ?? 24;
    const stdinStream = new PassThrough();
    const stdoutStream = new ResizablePassThrough(initialCols, initialRows);

    let exitCb: ((code: number | null) => void) | undefined;
    let exited = false;

    // If cmd contains spaces it is a compound command (e.g. tmux ...)
    // and must be executed through a shell so arguments are parsed correctly.
    const cmd = opts.cmd || "/bin/sh";
    const execCmd = cmd.includes(" ") ? ["sh", "-c", cmd] : [cmd];

    // K8s exec with tty=true
    const execPromise = exec.exec(
      ns,
      pod,
      "main",
      execCmd,
      stdoutStream, // stdout
      stdoutStream, // stderr (merged into stdout when tty=true)
      stdinStream, // stdin
      true, // tty = true
      (status: unknown) => {
        exited = true;
        let code: number | null = null;
        if (status && typeof (status as { status?: string }).status === "string") {
          code = (status as { status: string }).status === "Success" ? 0 : 1;
        }
        exitCb?.(code);
      },
    );

    // Swallow exec promise errors so they don't become unhandled rejections
    execPromise.catch(() => {
      if (!exited) {
        exited = true;
        exitCb?.(1);
      }
    });

    return {
      id,
      write(data) {
        stdinStream.write(data);
      },
      onData(cb) {
        stdoutStream.on("data", (chunk: Buffer) => cb(chunk));
      },
      resize(cols, rows) {
        // Kubernetes client-node sends terminal dimensions through the exec
        // resize channel when stdout exposes columns/rows and emits "resize".
        // Do not inject stty/tmux commands into stdin here: foreground TUI
        // programs would receive them as user input and may reset the window.
        stdoutStream.resize(cols, rows);
      },
      async kill() {
        stdinStream.destroy();
        stdoutStream.destroy();
      },
      onExit(cb) {
        if (exited) {
          cb(null);
        } else {
          exitCb = cb;
          stdoutStream.on("end", () => {
            if (!exited) {
              exited = true;
              cb(null);
            }
          });
        }
      },
    };
  }

  async portForward(port: number): Promise<PortForwardHandle> {
    await this.start();
    const pod = this.ensureStarted();
    if (!this.kc) throw new Error("KubeConfig not loaded");
    const ns = await this.resolveNamespace();

    this.dbg("portForward: starting native K8s port-forward", {
      ns,
      pod,
      port,
    });

    // Use native K8s PortForward API (WebSocket/SPDY based).
    // This works at the kubelet level and does NOT require any tools
    // (socat/nc/bash) inside the container.
    const fwd = new K8sPortForward(this.kc);
    const stdoutStream = new PassThrough();
    const stdinStream = new PassThrough();

    let closed = false;
    const closeCbs: Array<() => void> = [];
    const errorCbs: Array<(err: Error) => void> = [];

    let wsOrFactory: unknown;

    try {
      wsOrFactory = await fwd.portForward(ns, pod, [port], stdoutStream, null, stdinStream);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.dbg("portForward: native API failed", msg);
      throw new Error(`portForward failed: ${msg}`);
    }

    this.dbg("portForward: native API connected");

    // Handle WebSocket close
    const ws: {
      readyState?: number;
      OPEN?: number;
      close?: () => void;
      onclose?: unknown;
      onerror?: unknown;
    } | null =
      typeof wsOrFactory === "function"
        ? ((wsOrFactory as () => unknown)() as typeof ws)
        : (wsOrFactory as typeof ws);
    if (ws) {
      ws.onclose = () => {
        if (!closed) {
          closed = true;
          for (const cb of closeCbs) cb();
        }
      };
      ws.onerror = (evt: unknown) => {
        const err =
          evt instanceof Error
            ? evt
            : new Error(String((evt as { message?: string })?.message ?? evt));
        for (const cb of errorCbs) cb(err);
      };
    }

    stdoutStream.on("end", () => {
      if (!closed) {
        closed = true;
        for (const cb of closeCbs) cb();
      }
    });

    return {
      write: (data) => {
        if (!closed) {
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          this.dbg("portForward: write", buf.length, "bytes");
          stdinStream.write(buf);
        }
      },
      onData: (cb) => {
        stdoutStream.on("data", (chunk: Buffer) => {
          this.dbg("portForward: recv", chunk.length, "bytes");
          cb(chunk);
        });
      },
      onClose(cb) {
        if (closed) {
          cb();
        } else {
          closeCbs.push(cb);
        }
      },
      onError(cb) {
        errorCbs.push(cb);
        stdoutStream.on("error", cb);
      },
      close() {
        if (!closed) {
          closed = true;
          stdinStream.end();
          if (ws && ws.close && ws.readyState === ws.OPEN) {
            ws.close();
          }
        }
      },
    };
  }
}

export default KubernetesSandboxProvider;

// ---------------------------------------------------------------------------
// Utility: pack a single file into a tar archive buffer in memory
// ---------------------------------------------------------------------------
async function packTarEntry(name: string, data: Buffer, mode: number): Promise<Buffer> {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  pack.on("data", (chunk: Buffer) => chunks.push(chunk));
  return new Promise<Buffer>((resolve, reject) => {
    pack.on("end", () => resolve(Buffer.concat(chunks)));
    pack.on("error", reject);
    pack.entry({ name, mode, size: data.length }, data);
    pack.finalize();
  });
}
