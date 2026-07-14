import {
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { generateNanoID } from "openlib/nanoid";

/**
 * Sandbox Provider Enum
 */
export const sandboxProviderEnum = pgEnum("sandbox_provider", ["DOCKER", "KUBERNETES", "LOCAL"]);

/**
 * Sandbox Status Enum
 */
export const sandboxStatusEnum = pgEnum("sandbox_status", [
  "CREATING",
  "RUNNING",
  "STOPPED",
  "PAUSED",
  "ERROR",
  "DELETING",
  "DELETED",
]);

/**
 * Sandbox table - core sandbox entity.
 *
 * `spaceId`/`userId` are plain, unconstrained text columns (no `.references()`) so this
 * table stays portable across hosts: `apps/sandock` (single-tenant, no organizations/
 * users tables at all) and `apps/sandock-cloud` (multi-tenant, ties these to its own auth schema
 * at the application layer) both consume the same table shape. Mirrors busabase-core's
 * `space-column.ts` decoupling technique.
 */
export const sandboxes = pgTable(
  "sandboxes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateNanoID("sbx", 16)),
    spaceId: text("space_id"),
    userId: text("user_id").notNull(), // Owner of the sandbox (for subPath isolation)
    title: text("title").notNull(),
    provider: sandboxProviderEnum("provider").notNull().default("DOCKER"),
    providerRef: text("provider_ref"), // Container ID / Pod name / Local path
    status: sandboxStatusEnum("status").notNull().default("CREATING"),
    image: text("image"),
    cpuLimit: integer("cpu_limit"),
    memoryLimit: integer("memory_limit"),
    command: json("command").$type<string[]>(),
    env: json("env").$type<Record<string, string>>(),
    metadata: json("metadata"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    // Metrics / lifecycle enrichment
    firstStartedAt: timestamp("first_started_at", { mode: "date" }),
    lastStartedAt: timestamp("last_started_at", { mode: "date" }),
    lastStoppedAt: timestamp("last_stopped_at", { mode: "date" }),
    accumulatedRunMs: integer("accumulated_run_ms").notNull().default(0),
    lastStartupDurationMs: integer("last_startup_duration_ms"),
    statusChangedAt: timestamp("status_changed_at", { mode: "date" }),
    // Billing accumulation
    accumulatedCpuCoreMs: integer("accumulated_cpu_core_ms").notNull().default(0),
    accumulatedMemMiBSeconds: integer("accumulated_mem_mib_seconds").notNull().default(0),
    // Persistence fields (Note: volumeName moved to spaces table for space-level persistence)
    persistenceEnabled: boolean("persistence_enabled").notNull().default(false),
    lastPausedAt: timestamp("last_paused_at", { mode: "date" }),
    lastResumedAt: timestamp("last_resumed_at", { mode: "date" }),
    templateId: text("template_id"), // Reference to template if created from one
    // Auto-delete interval in minutes for stopped sandboxes.
    // -1: disable auto-delete; 0: delete immediately on stop; null: use default (1440 min = 1 day)
    autoDeleteInterval: integer("auto_delete_interval"),
  },
  (table) => [
    index("sandboxes_space_id_idx").on(table.spaceId),
    index("sandboxes_user_id_idx").on(table.userId),
    index("sandboxes_status_idx").on(table.status),
    index("sandboxes_template_id_idx").on(table.templateId),
  ],
);

/**
 * Sandbox Lifecycle Event Type Enum
 */
export const sandboxLifecycleEventTypeEnum = pgEnum("sandbox_lifecycle_event_type", [
  "CREATED",
  "START_ATTEMPT",
  "START_SUCCESS",
  "START_FAIL",
  "RESTART_FAIL",
  "STATUS_CHANGE",
  "STOP",
  "PAUSE",
  "RESUME_ATTEMPT",
  "RESUME_SUCCESS",
  "RESUME_FAIL",
  "DELETE_ATTEMPT",
  "DELETED",
  "HEARTBEAT",
  "RECONCILE_STOP",
  "RETENTION_DELETE",
  "RUN_SEGMENT_END",
]);

/**
 * SandboxLifecycleEvent table - lifecycle events
 */
export const sandboxLifecycleEvents = pgTable(
  "sandbox_lifecycle_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateNanoID("sle", 16)),
    sandboxId: text("sandbox_id")
      .notNull()
      .references(() => sandboxes.id),
    type: sandboxLifecycleEventTypeEnum("type").notNull(),
    fromStatus: sandboxStatusEnum("from_status"),
    toStatus: sandboxStatusEnum("to_status"),
    ts: timestamp("ts", { mode: "date" }).defaultNow().notNull(),
    meta: json("meta"),
  },
  (table) => [
    index("sandbox_lifecycle_events_sandbox_id_ts_idx").on(table.sandboxId, table.ts),
    index("sandbox_lifecycle_events_type_idx").on(table.type),
  ],
);

/**
 * SandboxRunSegment table - continuous running segments
 */
export const sandboxRunSegments = pgTable(
  "sandbox_run_segments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateNanoID("srs", 16)),
    sandboxId: text("sandbox_id")
      .notNull()
      .references(() => sandboxes.id),
    startAt: timestamp("start_at", { mode: "date" }).notNull(),
    endAt: timestamp("end_at", { mode: "date" }),
    endReason: text("end_reason"), // STOPPED | ERROR | RECONCILE | DELETE
    durationMs: integer("duration_ms"),
    cpuCoreMs: integer("cpu_core_ms"),
    memMiBSeconds: integer("mem_mib_seconds"),
  },
  (table) => [
    index("sandbox_run_segments_sandbox_id_start_at_idx").on(table.sandboxId, table.startAt),
    index("sandbox_run_segments_end_at_idx").on(table.endAt),
  ],
);

// Zod schemas for validation
export const insertSandboxSchema = createInsertSchema(sandboxes);
export const selectSandboxSchema = createSelectSchema(sandboxes);

// Types
export type Sandbox = typeof sandboxes.$inferSelect;
export type InsertSandbox = typeof sandboxes.$inferInsert;
export type SandboxLifecycleEvent = typeof sandboxLifecycleEvents.$inferSelect;
export type InsertSandboxLifecycleEvent = typeof sandboxLifecycleEvents.$inferInsert;
export type SandboxRunSegment = typeof sandboxRunSegments.$inferSelect;
export type InsertSandboxRunSegment = typeof sandboxRunSegments.$inferInsert;

// Export enum types for type-safe usage
export type SandboxProvider = (typeof sandboxProviderEnum.enumValues)[number];
export type SandboxStatus = (typeof sandboxStatusEnum.enumValues)[number];
export type SandboxLifecycleEventType = (typeof sandboxLifecycleEventTypeEnum.enumValues)[number];
