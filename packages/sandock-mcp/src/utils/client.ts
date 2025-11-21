/**
 * Sandock client initialization
 */

import { createSandockClient } from "sandock";
import type { ToolContext } from "../types/common.js";

/**
 * Initialize Sandock client with environment-based configuration
 */
export function initializeClient(): ToolContext {
  const apiUrl = process.env.SANDOCK_API_URL || "https://sandock.ai";
  const apiKey = process.env.SANDOCK_API_KEY;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const client = createSandockClient({
    baseUrl: apiUrl,
    headers,
  });

  return {
    client,
    apiUrl,
    apiKey,
  };
}
