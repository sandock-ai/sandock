CREATE TYPE "public"."sandbox_lifecycle_event_type" AS ENUM('CREATED', 'START_ATTEMPT', 'START_SUCCESS', 'START_FAIL', 'RESTART_FAIL', 'STATUS_CHANGE', 'STOP', 'PAUSE', 'RESUME_ATTEMPT', 'RESUME_SUCCESS', 'RESUME_FAIL', 'DELETE_ATTEMPT', 'DELETED', 'HEARTBEAT', 'RECONCILE_STOP', 'RETENTION_DELETE', 'RUN_SEGMENT_END');--> statement-breakpoint
CREATE TYPE "public"."sandbox_provider" AS ENUM('DOCKER', 'KUBERNETES', 'LOCAL');--> statement-breakpoint
CREATE TYPE "public"."sandbox_status" AS ENUM('CREATING', 'RUNNING', 'STOPPED', 'PAUSED', 'ERROR', 'DELETING', 'DELETED');--> statement-breakpoint
CREATE TABLE "sandbox_lifecycle_events" (
	"id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"type" "sandbox_lifecycle_event_type" NOT NULL,
	"from_status" "sandbox_status",
	"to_status" "sandbox_status",
	"ts" timestamp DEFAULT now() NOT NULL,
	"meta" json
);
--> statement-breakpoint
CREATE TABLE "sandbox_run_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"end_reason" text,
	"duration_ms" integer,
	"cpu_core_ms" integer,
	"mem_mib_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "sandboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"provider" "sandbox_provider" DEFAULT 'DOCKER' NOT NULL,
	"provider_ref" text,
	"status" "sandbox_status" DEFAULT 'CREATING' NOT NULL,
	"image" text,
	"cpu_limit" integer,
	"memory_limit" integer,
	"command" json,
	"env" json,
	"metadata" json,
	"last_heartbeat_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"first_started_at" timestamp,
	"last_started_at" timestamp,
	"last_stopped_at" timestamp,
	"accumulated_run_ms" integer DEFAULT 0 NOT NULL,
	"last_startup_duration_ms" integer,
	"status_changed_at" timestamp,
	"accumulated_cpu_core_ms" integer DEFAULT 0 NOT NULL,
	"accumulated_mem_mib_seconds" integer DEFAULT 0 NOT NULL,
	"persistence_enabled" boolean DEFAULT false NOT NULL,
	"last_paused_at" timestamp,
	"last_resumed_at" timestamp,
	"template_id" text,
	"auto_delete_interval" integer
);
--> statement-breakpoint
ALTER TABLE "sandbox_lifecycle_events" ADD CONSTRAINT "sandbox_lifecycle_events_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_run_segments" ADD CONSTRAINT "sandbox_run_segments_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sandbox_lifecycle_events_sandbox_id_ts_idx" ON "sandbox_lifecycle_events" USING btree ("sandbox_id","ts");--> statement-breakpoint
CREATE INDEX "sandbox_lifecycle_events_type_idx" ON "sandbox_lifecycle_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sandbox_run_segments_sandbox_id_start_at_idx" ON "sandbox_run_segments" USING btree ("sandbox_id","start_at");--> statement-breakpoint
CREATE INDEX "sandbox_run_segments_end_at_idx" ON "sandbox_run_segments" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "sandboxes_space_id_idx" ON "sandboxes" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "sandboxes_user_id_idx" ON "sandboxes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sandboxes_status_idx" ON "sandboxes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sandboxes_template_id_idx" ON "sandboxes" USING btree ("template_id");