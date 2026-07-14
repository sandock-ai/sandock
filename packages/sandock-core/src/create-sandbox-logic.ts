import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { type Sandbox, sandboxes } from "./db/schema";
import { generateUniqueRandomSandboxName } from "./random-name";
import type { SandboxManager } from "./sandbox-manager";
import type { VolumeMountInput } from "./volume-provider";

export type CreateSandboxErrorCode = "SPACE_NOT_FOUND" | "QUOTA_EXCEEDED";

export class CreateSandboxError extends Error {
  constructor(
    public readonly code: CreateSandboxErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CreateSandboxError";
  }
}

export interface ReserveSandboxForCreateInput {
  userId: string;
  spaceId: string;
  actorUserId: string;
  title?: string;
  image?: string;
  cpuLimit?: number;
  memoryLimit?: number;
  activeDeadlineSeconds?: number;
  command?: string[];
  metadata?: Record<string, unknown>;
  volumes?: VolumeMountInput[];
  env?: Record<string, string>;
  clusterId?: string;
  autoDeleteInterval?: number;
}

/**
 * Tenant quota policy, injected by the host app. Runs inside the same transaction as the
 * sandbox insert (so e.g. a `SELECT ... FOR UPDATE` row lock on the host's own spaces/billing
 * table is consistent with the count it's checking against). Throw `CreateSandboxError` to
 * reject the reservation. `apps/sandock-cloud` injects a real space/plan lookup; `apps/sandock`
 * (single-tenant, no billing) omits this — unlimited by default.
 */
export type CheckSandboxQuota = (tx: Database, spaceId: string) => Promise<void>;

/** Sandbox statuses that count toward a tenant's quota. Reused by `checkQuota` implementations
 * so the "what counts as active" definition doesn't drift between sandock-core and hosts. */
export const activeQuotaStatuses = ["CREATING", "RUNNING"] as const;
const placeholderTitles = new Set(["New Sandbox", "Untitled Sandbox"]);

export async function reserveSandboxForCreate(
  database: Pick<Database, "transaction">,
  sandboxManager: SandboxManager,
  input: ReserveSandboxForCreateInput,
  checkQuota?: CheckSandboxQuota,
): Promise<Sandbox> {
  return await database.transaction(async (tx) => {
    if (checkQuota) {
      await checkQuota(tx, input.spaceId);
    }

    let title = input.title;
    if (!title || placeholderTitles.has(title)) {
      const existingSandboxes = await tx
        .select({ title: sandboxes.title })
        .from(sandboxes)
        .where(and(eq(sandboxes.spaceId, input.spaceId), isNull(sandboxes.deletedAt)));

      title = generateUniqueRandomSandboxName(existingSandboxes.map((sandbox) => sandbox.title));
    }

    return await sandboxManager.reserve({
      userId: input.userId,
      spaceId: input.spaceId,
      actorUserId: input.actorUserId,
      title,
      image: input.image,
      cpuLimit: input.cpuLimit,
      memoryLimit: input.memoryLimit,
      activeDeadlineSeconds: input.activeDeadlineSeconds,
      command: input.command,
      metadata: input.metadata,
      volumes: input.volumes,
      env: input.env,
      clusterId: input.clusterId,
      autoDeleteInterval: input.autoDeleteInterval,
      dbClient: tx,
    });
  });
}

export async function createSandboxFromReservation(
  sandboxManager: SandboxManager,
  reservedSandbox: Sandbox,
): Promise<Sandbox> {
  return await sandboxManager.startReserved(reservedSandbox);
}
