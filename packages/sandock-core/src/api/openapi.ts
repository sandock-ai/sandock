import type { AnyContractRouter } from "@orpc/contract";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { sandboxBaseContract } from "sandock-contract/contract/sandbox";

const openApiGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

interface SpecOptions {
  title?: string;
  description?: string;
  version?: string;
}

/**
 * Generate an OpenAPI 3.0 spec from a sandbox oRPC contract. `apps/sandock` passes the base
 * contract; `apps/sandock-cloud` passes its cloud (superset) contract. Streaming/proxy routes that live
 * outside the contract (raw handlers) are merged into the spec by the host if it needs to document
 * them (see apps/sandock-cloud's spec augmentation).
 */
export async function generateSandboxOpenApiSpec(
  contract: AnyContractRouter,
  opts: SpecOptions = {},
) {
  const spec = await openApiGenerator.generate(contract, {
    info: {
      title: opts.title ?? "Sandbox API",
      version: opts.version ?? process.env.VERSION ?? "0.0.0",
      description:
        opts.description ??
        "Contract-first REST API for sandbox lifecycle, code/shell execution, and filesystem access.",
    },
    servers: [{ url: "/api/v1", description: "Sandbox API base path" }],
  });

  return { ...spec, openapi: "3.0.0" };
}

/** Convenience: the base (open) spec used by apps/sandock. */
export function getSandboxBaseOpenApiSpec(opts: SpecOptions = {}) {
  return generateSandboxOpenApiSpec(sandboxBaseContract, opts);
}
