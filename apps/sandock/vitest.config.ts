import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // sandock-core/db does `import "server-only"`, whose `default` export throws outside an RSC
      // graph. Node honors `--conditions=react-server` (its `react-server` export is a no-op), but
      // Vitest resolves deps through Vite, which doesn't apply that condition — so neutralize the
      // guard with a no-op alias (same pattern as packages/busabase-core, apps/productready).
      "server-only": path.resolve(__dirname, "./tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // The integration test boots a real sandbox + auto-migrates an in-memory PGLite db, so give it
    // generous headroom over the default 5s.
    testTimeout: 30_000,
    // Set BEFORE the test module graph is evaluated so sandock-core reads them at import time:
    //   - SANDBOX_PROVIDER is captured in a module-level const by SandboxManager (zero-infra LOCAL).
    //   - PG_DATABASE_URL selects a hermetic in-memory PGLite that auto-migrates on first use.
    // The db auto-migrate reads `${process.cwd()}/src/db/migrations`, so this config lives at the
    // package root and the test must be run from there (e.g. `pnpm --filter sandock-server test`).
    env: {
      SANDBOX_PROVIDER: "LOCAL",
      PG_DATABASE_URL: "pglite://memory://",
    },
  },
});
