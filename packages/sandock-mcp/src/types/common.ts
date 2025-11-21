/**
 * Common types used across the Sandock MCP server
 */

import type { SandockClient } from "sandock";

/**
 * Tool context passed to all tool implementations
 */
export interface ToolContext {
  client: SandockClient;
  apiUrl: string;
  apiKey: string | undefined;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  errorType: string;
  error: string;
  message: string;
  details?: Record<string, unknown>;
  solutions: string[];
  documentation?: string;
}

/**
 * Standard success response structure
 */
export interface SuccessResponse {
  success: true;
  [key: string]: unknown;
}

export type ToolResponse = SuccessResponse | ErrorResponse;
