/**
 * Sandock JS SDK
 *
 * Lightweight TypeScript SDK for Sandock API built with openapi-typescript + openapi-fetch.
 *
 * @example
 * ```ts
 * import { createSandockClient } from 'sandock-js'
 *
 * // Create client
 * const client = createSandockClient({
 *   baseUrl: 'https://sandock.ai',
 *   headers: { 'Authorization': 'Bearer your-api-key' }
 * })
 *
 * // Create sandbox and run code
 * const sandbox = await client.sandbox.create({ image: 'node:20-alpine' })
 * const result = await client.sandbox.runCode(sandbox.data.id, {
 *   language: 'javascript',
 *   code: 'console.log("hello")'
 * })
 *
 * // Stream output in real-time (just add callbacks)
 * await client.sandbox.runCode(sandboxId, { language: 'python', code: 'print("hi")' }, {
 *   onStdout: (chunk) => console.log(chunk),
 *   onStderr: (chunk) => console.error(chunk),
 * })
 *
 * // Shell with streaming
 * await client.sandbox.shell(sandboxId, 'ls -la', {
 *   onStdout: (chunk) => process.stdout.write(chunk),
 * })
 *
 * // Raw API access (openapi-fetch)
 * const { data } = await client.GET('/api/v1/meta')
 * ```
 */

// Types
export type {
  ExecutionResult,
  RunCodeOptions,
  SandboxCreateOptions,
  SandockClient,
  SandockClientOptions,
  ShellOptions,
  StreamCallbacks,
} from "./client";
// Main client export
export { createSandockClient } from "./client";

// Re-export types from schema for convenience
export type { components, paths } from "./schema";
