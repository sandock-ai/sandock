/**
 * Per-request oRPC context for the sandbox API. The host app resolves `actor` from its own auth
 * (sandock: API key → userId + spaceId; sandock-open: a fixed local actor) and threads it in via
 * the OpenAPIHandler/RPCHandler `context`. The router (see ./router.ts) reads `context.actor`;
 * the `SandboxManager` itself is captured by the router factory, not carried in context.
 */
export interface SandboxActor {
  userId: string;
  /** Active workspace/space. `null` for single-tenant deployments (sandock-open). */
  spaceId: string | null;
}

export interface SandboxApiContext {
  actor: SandboxActor;
  /**
   * The originating fetch Request, when the host uses the fetch adapter (apps/sandock-cloud — its auth
   * middleware reads the API key from here). Absent when the host uses the Node adapter with a
   * pre-resolved actor (apps/sandock); the base router never reads it.
   */
  request?: Request;
}
