/**
 * Tool: Run Code
 *
 * Execute code in an isolated sandbox environment.
 * This tool handles the complete lifecycle:
 * 1. Creates a new ephemeral sandbox
 * 2. Executes the provided code using the /code endpoint
 * 3. Returns stdout, stderr, exit code, and execution stats
 * 4. Automatically cleans up the sandbox
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ToolContext } from "../types/common.js";
import { formatResponse, getErrorMessage, getErrorStatus } from "../utils/error-helpers.js";

// Fixed Docker image for consistent Python environment
// Published at: https://hub.docker.com/r/seey/sandock-python
const SANDOCK_PYTHON_IMAGE = "seey/sandock-python:latest";

export const runCodeSchema = z.object({
  code: z.string().describe("Python code to execute. Use print() to output results."),
  timeout: z
    .number()
    .int()
    .positive()
    .default(30)
    .describe("Execution timeout in seconds (default: 30, max: 300)"),
});

export type RunCodeArgs = z.infer<typeof runCodeSchema>;

export async function runCode(args: RunCodeArgs, context: ToolContext) {
  const { client, apiUrl, apiKey } = context;
  const { code, timeout } = args;
  const language = "python"; // Only support Python
  const maxTimeout = Math.min(timeout, 300); // Cap at 5 minutes
  let sandboxId: string | null = null;

  try {
    // Validate API configuration
    if (!apiKey) {
      return formatResponse({
        success: false,
        errorType: "CONFIGURATION_ERROR",
        error: "Sandock API key is not configured",
        message: "The SANDOCK_API_KEY environment variable is required to execute code",
        solutions: [
          "Set the environment variable: export SANDOCK_API_KEY='your-api-key'",
          "Get your API key from https://sandock.ai/dashboard",
          "Verify the API key has sufficient permissions and hasn't expired",
        ],
        documentation: "https://sandock.ai/docs",
      });
    }

    // Step 1: Create a new sandbox
    const sandboxName = `mcp-python-${randomUUID().slice(0, 8)}`;

    const { data: createData, error: createError } = await client.POST("/api/sandbox", {
      body: {
        name: sandboxName,
        image: SANDOCK_PYTHON_IMAGE,
        keep: false, // Ephemeral sandbox
      },
    });

    if (createError || !createData) {
      const statusCode = getErrorStatus(createError);
      const errorMessage = getErrorMessage(createError);

      let errorType = "SANDBOX_CREATION_FAILED";
      let solutions: string[] = [];
      let message = "Failed to create an isolated sandbox environment";

      if (statusCode === 401 || statusCode === 403) {
        errorType = "AUTHENTICATION_ERROR";
        message = "Authentication failed when trying to create a sandbox";
        solutions = [
          "Verify SANDOCK_API_KEY is correct and not expired",
          "Check that the API key has 'sandbox:create' permissions",
          "Re-authenticate at https://sandock.ai/dashboard",
        ];
      } else if (statusCode === 429) {
        errorType = "RATE_LIMIT_ERROR";
        message = "Too many sandbox creation requests";
        solutions = [
          "Wait a few seconds before retrying",
          "Consider increasing the interval between sandbox creations",
          "Check your account rate limits at https://sandock.ai/dashboard",
        ];
      } else if (statusCode === 503 || statusCode === 502) {
        errorType = "SERVICE_UNAVAILABLE";
        message = "Sandock API service is temporarily unavailable";
        solutions = [
          "Retry the request after a short delay (exponential backoff)",
          "Check service status at https://status.sandock.ai",
          "If the issue persists, contact support@sandock.ai",
        ];
      } else if (statusCode === 400) {
        errorType = "INVALID_REQUEST";
        message = "Invalid request parameters when creating sandbox";
        solutions = [
          `Ensure the API URL is correct: ${apiUrl}`,
          "Check that all required fields in the sandbox creation request are valid",
          "Review the Sandock API documentation for sandbox creation parameters",
        ];
      } else {
        solutions = [
          "Check Sandock API status and connectivity",
          `Verify the API URL is correct: ${apiUrl}`,
          "Enable debug mode for more detailed error information",
          "Review API documentation: https://sandock.ai/docs/api",
        ];
      }

      return formatResponse({
        success: false,
        errorType,
        error: "Sandbox creation failed",
        message,
        details: {
          statusCode,
          apiUrl,
          errorMessage,
        },
        solutions,
        sandboxId: null,
      });
    }

    sandboxId = createData.data.id;

    // Step 2: Execute code using the /code endpoint
    const { data: execData, error: execError } = await client.POST("/api/sandbox/{id}/code", {
      params: {
        path: { id: sandboxId },
      },
      body: {
        language,
        code,
        timeoutMs: maxTimeout * 1000,
      },
    });

    if (execError || !execData) {
      const statusCode = getErrorStatus(execError);
      const errorMessage = getErrorMessage(execError);

      let errorType = "CODE_EXECUTION_FAILED";
      let solutions: string[] = [];
      let message = "Code execution in the sandbox failed";

      if (statusCode === 404) {
        errorType = "SANDBOX_NOT_FOUND";
        message = "The sandbox no longer exists or was already cleaned up";
        solutions = [
          "Retry creating a new sandbox and executing the code",
          "Check if the sandbox was terminated due to inactivity",
        ];
      } else if (statusCode === 408 || statusCode === 504) {
        errorType = "EXECUTION_TIMEOUT";
        message = "Code execution exceeded the timeout limit";
        solutions = [
          `Increase the timeout parameter (current: ${timeout}s, max: 300s)`,
          "Optimize your code to run faster",
          "Break long-running operations into smaller tasks",
          "Use connection pooling or batch operations for network calls",
        ];
      } else if (statusCode === 413) {
        errorType = "REQUEST_TOO_LARGE";
        message = "The code or input is too large";
        solutions = [
          "Reduce the size of the code being executed",
          "Use external files or resources instead of embedding large data",
          "Split large operations into multiple smaller executions",
        ];
      } else if (statusCode === 400) {
        errorType = "INVALID_CODE";
        message = "Invalid Python code or unsupported syntax";
        solutions = [
          "Verify the Python code syntax",
          "Ensure all required dependencies are available in the sandbox",
          "Check the Sandock documentation for Python-specific requirements",
        ];
      } else if (statusCode === 401 || statusCode === 403) {
        errorType = "PERMISSION_DENIED";
        message = "Permission denied when executing code";
        solutions = [
          "Verify API key permissions",
          "Check that the API key has 'sandbox:execute' permissions",
        ];
      } else {
        solutions = [
          "Verify the code is syntactically correct for the specified language",
          "Check sandbox resource availability (CPU, memory, disk)",
          "Retry the execution",
          "Review detailed error output from stderr",
        ];
      }

      return formatResponse({
        success: false,
        errorType,
        error: "Code execution failed",
        message,
        details: {
          statusCode,
          language,
          sandboxId,
          errorMessage,
          codePreview: code.length > 200 ? `${code.slice(0, 200)}...` : code,
        },
        solutions,
      });
    }

    const result = execData.data;

    // Step 3: Return structured results
    return formatResponse({
      success: result.exitCode === 0,
      language,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      sandboxId,
      // Provide guidance when execution fails
      ...(result.exitCode !== 0 && {
        executionFailed: true,
        troubleshooting: [
          "Check stderr output for specific error details",
          "Ensure all required Python packages are available",
          "Check for runtime errors in the code logic",
          "Verify input parameters and data types",
        ],
      }),
      ...(result.timedOut && {
        timeout: true,
        troubleshooting: [
          `Execution exceeded the ${maxTimeout}s timeout limit`,
          "Consider optimizing the code performance",
          "Increase timeout if the operation legitimately requires more time",
          "Break the operation into smaller, faster tasks",
        ],
      }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "Unknown";

    return formatResponse({
      success: false,
      errorType: "INTERNAL_ERROR",
      error: "Unexpected error during code execution",
      message: errorMessage,
      errorName,
      details: {
        sandboxId: sandboxId || null,
        language: "python",
        timeout,
      },
      solutions: [
        "Check that the Sandock API service is running and accessible",
        `Verify network connectivity to ${apiUrl}`,
        "Check system logs for more detailed error information",
        "If the issue persists, contact support@sandock.ai with the error details",
        "Enable debug logging by setting DEBUG=sandock:*",
      ],
      debugTip: "For more information, check the full error stack in the server logs",
    });
  } finally {
    // Step 4: Clean up the sandbox (async, non-blocking)
    if (sandboxId) {
      client
        .DELETE("/api/sandbox/{id}", {
          params: {
            path: { id: sandboxId },
          },
        })
        .catch((cleanupError) => {
          console.error(`Failed to cleanup sandbox ${sandboxId}:`, cleanupError);
        });
    }
  }
}
