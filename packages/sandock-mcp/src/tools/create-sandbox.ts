/**
 * Tool: Create Sandbox
 *
 * Create a new isolated sandbox environment.
 * Returns a sandboxId that must be used in subsequent operations.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ToolContext } from "../types/common.js";
import { formatResponse, getErrorMessage, getErrorStatus } from "../utils/error-helpers.js";

// Fixed Docker image for consistent Python environment
// Published at: https://hub.docker.com/r/seey/sandock-python
const SANDOCK_PYTHON_IMAGE = "seey/sandock-python:latest";

export const createSandboxSchema = z.object({
  name: z.string().optional().describe("Optional name for the sandbox (default: auto-generated)"),
  memoryLimitMb: z.number().int().positive().optional().describe("Memory limit in MB"),
  cpuShares: z.number().int().positive().optional().describe("CPU shares (relative weight)"),
  keep: z
    .boolean()
    .default(false)
    .describe("Keep sandbox alive (default: false for ephemeral sandboxes)"),
});

export type CreateSandboxArgs = z.infer<typeof createSandboxSchema>;

export async function createSandbox(args: CreateSandboxArgs, context: ToolContext) {
  const { client, apiUrl, apiKey } = context;

  try {
    // Validate API configuration
    if (!apiKey) {
      return formatResponse({
        success: false,
        errorType: "CONFIGURATION_ERROR",
        error: "Sandock API key is not configured",
        message: "The SANDOCK_API_KEY environment variable is required",
        solutions: [
          "Set the environment variable: export SANDOCK_API_KEY='your-api-key'",
          "Get your API key from https://sandock.ai/dashboard",
        ],
      });
    }

    const sandboxName = args.name || `mcp-sandbox-${randomUUID().slice(0, 8)}`;

    const { data, error } = await client.POST("/api/sandbox", {
      body: {
        name: sandboxName,
        image: SANDOCK_PYTHON_IMAGE,
        ...(args.memoryLimitMb && { memoryLimitMb: args.memoryLimitMb }),
        ...(args.cpuShares && { cpuShares: args.cpuShares }),
        keep: args.keep,
      },
    });

    if (error || !data) {
      const statusCode = getErrorStatus(error);
      const errorMessage = getErrorMessage(error);

      let errorType = "SANDBOX_CREATION_FAILED";
      let solutions: string[] = [];
      let message = "Failed to create sandbox";

      if (statusCode === 401 || statusCode === 403) {
        errorType = "AUTHENTICATION_ERROR";
        message = "Authentication failed";
        solutions = [
          "Verify SANDOCK_API_KEY is correct and not expired",
          "Check API key permissions at https://sandock.ai/dashboard",
        ];
      } else if (statusCode === 429) {
        errorType = "RATE_LIMIT_ERROR";
        message = "Too many requests";
        solutions = ["Wait before retrying", "Check rate limits at dashboard"];
      } else {
        solutions = [
          "Check Sandock API connectivity",
          `Verify API URL: ${apiUrl}`,
          "Review documentation: https://sandock.ai/docs/api",
        ];
      }

      return formatResponse({
        success: false,
        errorType,
        error,
        message,
        details: { statusCode, errorMessage },
        solutions,
      });
    }

    return formatResponse({
      success: true,
      sandboxId: data.data.id,
      name: sandboxName,
      message: "Sandbox created successfully. Use this sandboxId for subsequent operations.",
    });
  } catch (error) {
    return formatResponse({
      success: false,
      errorType: "INTERNAL_ERROR",
      error: "Unexpected error during sandbox creation",
      message: error instanceof Error ? error.message : String(error),
      solutions: [
        "Check network connectivity",
        "Verify Sandock API is accessible",
        "Check system logs for details",
      ],
    });
  }
}
