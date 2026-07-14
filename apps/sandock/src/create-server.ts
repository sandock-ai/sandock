import http from "node:http";
import { OpenAPIHandler } from "@orpc/openapi/node";
import type { SandboxApiContext } from "sandock-core/api/context";
import { getSandboxBaseOpenApiSpec } from "sandock-core/api/openapi";
import { createSandboxRouter } from "sandock-core/api/router";
import { db } from "sandock-core/db";
import { SandboxManager } from "sandock-core/sandbox-manager";

/**
 * apps/sandock — the thin oRPC glue layer. Single-tenant, no auth, no UI: it serves the
 * shared `sandock-contract` base contract (lifecycle + exec + fs) implemented once in sandock-core,
 * backed by sandock-core's own PGLite db. A fixed local actor stands in for the multi-tenant
 * userId/spaceId that apps/sandock-cloud resolves from API keys.
 *
 * The server construction lives here (rather than in the `src/server.ts` entrypoint) so it can be
 * driven by integration tests over real HTTP without also binding the process's listen port.
 */

// NOTE: SANDBOX_PROVIDER can't be defaulted here — the `sandock-core/sandbox-manager`
// import above already captured it into a module-level const (defaulting to "DOCKER")
// by the time any statement in this file runs; ES module imports are hoisted and
// evaluate before the importing file's own top-level code, no matter where a `??=`
// line is placed textually. Callers must set SANDBOX_PROVIDER before importing this
// module: `server.ts` does it via `./env-defaults` (imported first); tests do it via
// `vitest.config.ts`'s `env` field (injected before the test's module graph loads).

const LOCAL_ACTOR = { userId: "local", spaceId: null } as const;

const swaggerHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<title>Sandbox Open API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
<style>body { margin:0; } #swagger-ui { height:100vh; }</style>
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.onload = () => { window.ui = SwaggerUIBundle({ url: '/api/v1/openapi.json', dom_id: '#swagger-ui', deepLinking: true }); };</script>
</body></html>`;

/**
 * Build the sandock HTTP server (oRPC OpenAPI mount + openapi.json + swagger doc + 404
 * envelope), wired to the sandock-core db singleton and the fixed local actor. Returns an
 * unbound `http.Server`; the caller decides when/where to `.listen(...)`.
 */
export function createSandboxOpenServer(): http.Server {
  const manager = new SandboxManager(db);
  const router = createSandboxRouter(manager);
  const handler = new OpenAPIHandler<SandboxApiContext>(router);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/api/v1/openapi.json") {
      const spec = await getSandboxBaseOpenApiSpec({
        title: "Sandbox Open API",
        description: "Single-tenant headless sandbox execution API (open source).",
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(spec));
      return;
    }

    if (url.pathname === "/api/v1/doc") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(swaggerHtml);
      return;
    }

    const { matched } = await handler.handle(req, res, {
      context: { actor: LOCAL_ACTOR },
    });

    if (!matched) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          code: 404,
          message: `Not Found: ${url.pathname}`,
          data: {},
        }),
      );
    }
  });
}
