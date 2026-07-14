import "./env-defaults";
import { createSandboxOpenServer } from "./create-server";

/**
 * apps/sandock entrypoint — construct the sandock HTTP server (see ./create-server.ts)
 * and bind it to PORT. Kept intentionally thin so the server wiring stays unit/integration
 * testable without opening a real listen socket at import time.
 */

const PORT = Number(process.env.PORT ?? 3070);

const server = createSandboxOpenServer();

server.listen(PORT, () => {
  console.log(`[sandock] listening on http://localhost:${PORT}`);
  console.log(`[sandock] OpenAPI:  http://localhost:${PORT}/api/v1/openapi.json`);
  console.log(`[sandock] Swagger:  http://localhost:${PORT}/api/v1/doc`);
});
