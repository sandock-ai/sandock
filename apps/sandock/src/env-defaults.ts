/**
 * Must be the FIRST import in any entrypoint (server.ts), before anything that
 * transitively imports sandock-core/sandbox-manager — that module captures
 * SANDBOX_PROVIDER into a module-level const the moment it's first imported (its
 * own default is "DOCKER"), so setting the env var any later has no effect. This
 * file has no imports of its own, so it fully evaluates before the rest of the
 * entrypoint's import graph even starts (ES module imports run in declaration
 * order, depth-first).
 */
process.env.SANDBOX_PROVIDER ??= "LOCAL";
