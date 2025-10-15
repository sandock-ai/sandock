/**
 * Sandock JS SDK
 *
 * Lightweight TypeScript SDK for Sandock API built with openapi-typescript + openapi-fetch.
 *
 * @example
 * ```ts
 * import { createSandockClient } from 'sandock-js'
 *
 * // Production usage (default)
 * const client = createSandockClient()
 *
 * // Or with explicit configuration
 * const client = createSandockClient({
 *   baseUrl: 'https://sandock.ai',
 *   headers: { 'Authorization': 'Bearer your-api-key' }
 * })
 *
 * // Type-safe API calls with automatic inference
 * const { data, error } = await client.GET('/api/meta')
 * if (data) {
 *   console.log(data.data.version)
 * }
 *
 * // Get user by ID
 * const user = await client.GET('/api/user/{id}', {
 *   params: { path: { id: 'u_12345' } }
 * })
 * ```
 */

import createClient from "openapi-fetch";
import type { paths } from "./schema";

export type SandockClient = ReturnType<typeof createClient<paths>>;

export interface SandockClientOptions {
  /**
   * Base URL for the Sandock API
   * @default 'https://sandock.ai'
   */
  baseUrl?: string;

  /**
   * Optional headers to include with every request
   */
  headers?: Record<string, string>;

  /**
   * Optional fetch implementation (useful for custom fetch or Node.js environments)
   */
  fetch?: typeof globalThis.fetch;
}

/**
 * Create a type-safe Sandock API client
 *
 * @param options - Client configuration options
 * @returns Type-safe API client with GET, POST, PUT, DELETE, etc. methods
 *
 * @example
 * ```ts
 * const client = createSandockClient({
 *   baseUrl: 'https://sandock.ai',
 *   headers: { 'Authorization': 'Bearer token' }
 * })
 * ```
 */
export const createSandockClient = (options: SandockClientOptions = {}): SandockClient => {
  const { baseUrl = "https://sandock.ai", headers, fetch: customFetch } = options;

  return createClient<paths>({
    baseUrl,
    headers,
    fetch: customFetch,
  });
};

// Re-export types from schema for convenience
export type { components, paths } from "./schema";
