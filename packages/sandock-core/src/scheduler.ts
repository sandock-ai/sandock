// Periodic reconciliation & cleanup for sandboxes
// Loaded on server startup (import in an entry/server file)

import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "./db";
import { type SandboxStatus, sandboxes } from "./db/schema";
import type { SandboxManager } from "./sandbox-manager";
import type { SandboxReconciler } from "./sandbox-reconciler";

const RECONCILE_INTERVAL_MS = 60_000; // 1 min
const DEFAULT_AUTO_DELETE_INTERVAL_MIN = 1440; // 1 day (in minutes) for stopped sandboxes before auto-delete (soft)

// Purge retention-expired STOPPED sandboxes (soft delete). Separate from docker status reconciliation.
// Each sandbox may have its own autoDeleteInterval (in minutes):
//   -1 = never auto-delete; 0 = delete immediately; null = use default (1440 min); positive = custom minutes
async function purgeOldStopped(db: Database, sandboxManager: SandboxManager) {
  // Fetch all STOPPED sandboxes that are not yet deleted and not opted out of auto-delete
  const stoppedSandboxes = await db
    .select({
      id: sandboxes.id,
      updatedAt: sandboxes.updatedAt,
      autoDeleteInterval: sandboxes.autoDeleteInterval,
    })
    .from(sandboxes)
    .where(and(eq(sandboxes.status, "STOPPED" as SandboxStatus), isNull(sandboxes.deletedAt)));

  const now = Date.now();
  for (const s of stoppedSandboxes) {
    const interval = s.autoDeleteInterval ?? DEFAULT_AUTO_DELETE_INTERVAL_MIN;
    // -1 means auto-delete is disabled for this sandbox
    if (interval === -1) continue;
    const retentionMs = interval * 60_000;
    const cutoff = new Date(now - retentionMs);
    if (s.updatedAt > cutoff) continue;

    // Use SandboxManager.delete() to properly clean up provider resources (pods/containers)
    try {
      await sandboxManager.delete(s.id);
      console.log(`[Scheduler] Auto-deleted expired sandbox ${s.id}`);
    } catch (e) {
      console.error(`[Scheduler] Failed to auto-delete sandbox ${s.id}:`, e);
      // Continue with other sandboxes even if one fails
    }
  }
}

let started = false;
export function startSandboxScheduler(
  db: Database,
  sandboxManager: SandboxManager,
  sandboxReconciler: SandboxReconciler,
) {
  if (started) return;
  started = true;
  // Start docker reconcile loop (missing/terminated containers -> STOPPED metadata updates)
  sandboxReconciler.start();
  setInterval(() => {
    void purgeOldStopped(db, sandboxManager);
  }, RECONCILE_INTERVAL_MS).unref();
}
