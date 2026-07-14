// Sandbox metrics instrumentation helpers

import { and, eq, isNull, sql } from "drizzle-orm";
import { generateNanoID } from "openlib/nanoid";
import type { Database } from "./db";
import {
  type SandboxLifecycleEventType,
  type SandboxStatus,
  sandboxes,
  sandboxLifecycleEvents,
  sandboxRunSegments,
} from "./db/schema";

type EventClient = Pick<Database, "insert">;

export async function recordStatusEvent(
  db: Database,
  params: {
    sandboxId: string;
    fromStatus?: SandboxStatus | null;
    toStatus?: SandboxStatus | null;
    type?: SandboxLifecycleEventType; // default STATUS_CHANGE
    meta?: Record<string, unknown>;
    tx?: EventClient;
  },
) {
  const { sandboxId, fromStatus, toStatus, type = "STATUS_CHANGE", meta = {}, tx } = params;
  const client = tx ?? db;
  await client.insert(sandboxLifecycleEvents).values({
    id: generateNanoID("sde"),
    sandboxId,
    type,
    fromStatus: fromStatus || null,
    toStatus: toStatus || null,
    meta: meta as Record<string, unknown>,
  });
}

export async function openRunSegment(
  db: Database,
  sandboxId: string,
  startAt = new Date(),
  tx?: Database,
) {
  const client = tx ?? db;
  const open = await client
    .select({ id: sandboxRunSegments.id })
    .from(sandboxRunSegments)
    .where(and(eq(sandboxRunSegments.sandboxId, sandboxId), isNull(sandboxRunSegments.endAt)))
    .limit(1);
  if (open.length > 0) return open[0].id;
  const result = await client
    .insert(sandboxRunSegments)
    .values({
      id: generateNanoID("sde"),
      sandboxId,
      startAt,
    })
    .returning({ id: sandboxRunSegments.id });
  return result[0].id;
}

export async function closeRunSegment(
  db: Database,
  sandboxId: string,
  reason: string,
  when = new Date(),
  tx?: Database,
) {
  const client = tx ?? db;
  const seg = await client
    .select()
    .from(sandboxRunSegments)
    .where(and(eq(sandboxRunSegments.sandboxId, sandboxId), isNull(sandboxRunSegments.endAt)))
    .limit(1);
  if (seg.length === 0) return;
  const segment = seg[0];
  const durationMs = when.getTime() - segment.startAt.getTime();
  // Fetch sandbox row for limits (cpuLimit in milli-core? stored as Int) & memoryLimit (MiB)
  const sandbox = await client
    .select({ cpuLimit: sandboxes.cpuLimit, memoryLimit: sandboxes.memoryLimit })
    .from(sandboxes)
    .where(eq(sandboxes.id, sandboxId))
    .limit(1);
  let cpuCoreMs = null as number | null;
  let memMiBSeconds = null as number | null;
  if (sandbox.length > 0 && sandbox[0]) {
    const cpuLimit = sandbox[0].cpuLimit;
    const memoryLimit = sandbox[0].memoryLimit;
    const durationSec = durationMs / 1000;
    if (cpuLimit != null) {
      // Heuristic: if value <= 64 treat as cores; convert to milli-core.
      const milli = cpuLimit <= 64 ? cpuLimit * 1000 : cpuLimit; // allow already milli
      cpuCoreMs = Math.round((milli / 1000) * durationMs);
    }
    if (memoryLimit != null) {
      memMiBSeconds = Math.round(memoryLimit * durationSec);
    }
  }
  await client
    .update(sandboxRunSegments)
    .set({
      endAt: when,
      endReason: reason,
      durationMs,
      cpuCoreMs,
      memMiBSeconds,
    })
    .where(eq(sandboxRunSegments.id, segment.id));
  await client
    .update(sandboxes)
    .set({
      accumulatedRunMs: sql`${sandboxes.accumulatedRunMs} + ${durationMs}`,
      accumulatedCpuCoreMs:
        cpuCoreMs != null ? sql`${sandboxes.accumulatedCpuCoreMs} + ${cpuCoreMs}` : undefined,
      accumulatedMemMiBSeconds:
        memMiBSeconds != null
          ? sql`${sandboxes.accumulatedMemMiBSeconds} + ${memMiBSeconds}`
          : undefined,
      lastStoppedAt: when,
    })
    .where(eq(sandboxes.id, sandboxId));
  await client.insert(sandboxLifecycleEvents).values({
    id: generateNanoID("sde"),
    sandboxId,
    type: "RUN_SEGMENT_END",
    meta: { reason, durationMs, cpuCoreMs, memMiBSeconds },
  });
}

export async function recordStartSuccess(
  db: Database,
  sandboxId: string,
  createdAt: Date,
  isRestart: boolean,
  tx?: Database,
) {
  const client = tx ?? db;
  const now = new Date();
  const startupMs = now.getTime() - createdAt.getTime();
  await client
    .update(sandboxes)
    .set({
      firstStartedAt: isRestart ? undefined : now,
      lastStartedAt: now,
      lastStartupDurationMs: startupMs,
      statusChangedAt: now,
    })
    .where(eq(sandboxes.id, sandboxId));
  await client.insert(sandboxLifecycleEvents).values({
    id: generateNanoID("sde"),
    sandboxId,
    type: "START_SUCCESS",
    meta: { startupMs, restart: isRestart },
  });
  await openRunSegment(db, sandboxId, now, client);
}
