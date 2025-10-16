/**
 * Helper to create authenticated Sandock client from config
 */

import { createSandockClient, type SandockClient } from "sandock";
import { config } from "./config.js";

export function getClient(): SandockClient {
  const headers: Record<string, string> = {};

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return createSandockClient({
    baseUrl: config.apiUrl,
    headers,
  });
}
