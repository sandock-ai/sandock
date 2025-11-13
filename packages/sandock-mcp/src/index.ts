#!/usr/bin/env node

/**
 * Sandock MCP Server
 *
 * Model Context Protocol server for Sandock - provides AI agents with a simple tool
 * to execute code in isolated Docker sandbox environments.
 *
 * This MCP uses sandock-js SDK for:
 * 1. Creating ephemeral sandboxes
 * 2. Executing code with proper language support
 * 3. Returning structured output
 * 4. Automatic cleanup
 */

import { randomUUID } from "node:crypto";
import { FastMCP } from "fastmcp";
import { createSandockClient } from "sandock";
import { z } from "zod";

// Helper function to safely extract error details
function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errorObj = error as Record<string, unknown>;
  return (errorObj.status ?? errorObj.statusCode) as number | undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errorObj = error as Record<string, unknown>;
  return errorObj.message as string | undefined;
}

// Initialize Sandock client with environment-based configuration
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

// Create FastMCP server
const server = new FastMCP({
  name: "sandock-mcp",
  version: "0.1.0",
});

/**
 * Tool: Run Code
 *
 * Execute code in an isolated sandbox environment.
 * This tool handles the complete lifecycle:
 * 1. Creates a new ephemeral sandbox
 * 2. Executes the provided code using the /code endpoint
 * 3. Returns stdout, stderr, exit code, and execution stats
 */
server.addTool({
  name: "sandock_run_code",
  description:
    "Execute code (JavaScript, TypeScript, or Python) in an isolated sandbox environment",
  parameters: z.object({
    language: z
      .enum(["javascript", "typescript", "python"])
      .describe("Programming language: javascript, typescript, or python"),
    code: z
      .string()
      .describe(
        "The code to execute. Use console.log() (JavaScript/TypeScript) or print() (Python) to output results",
      ),
    timeout: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe("Execution timeout in seconds (default: 30, max: 300)"),
  }),
  execute: async (args) => {
    const { language, code, timeout } = args;
    const maxTimeout = Math.min(timeout, 300); // Cap at 5 minutes
    let sandboxId: string | null = null;

    try {
      // Validate API configuration
      if (!apiKey) {
        return JSON.stringify(
          {
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
          },
          null,
          2,
        );
      }

      // Step 1: Create a new sandbox
      const sandboxName = `mcp-${language}-${randomUUID().slice(0, 8)}`;

      const { data: createData, error: createError } = await client.POST("/api/sandbox", {
        body: {
          name: sandboxName,
          // Use default image from server (sandockai/sandock-code:latest)
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

        return JSON.stringify(
          {
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
          },
          null,
          2,
        );
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
          message = "Invalid code or unsupported syntax";
          solutions = [
            `Check that the language is correct: ${language}`,
            `Verify the code syntax for ${language}`,
            "Ensure all required dependencies are available in the sandbox",
            "Check the Sandock documentation for language-specific requirements",
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

        return JSON.stringify(
          {
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
          },
          null,
          2,
        );
      }

      const result = execData.data;

      // Step 3: Return structured results
      return JSON.stringify(
        {
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
              `Verify the language '${language}' is correctly specified`,
              "Ensure all required modules/packages are available",
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
        },
        null,
        2,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "Unknown";

      return JSON.stringify(
        {
          success: false,
          errorType: "INTERNAL_ERROR",
          error: "Unexpected error during code execution",
          message: errorMessage,
          errorName,
          details: {
            sandboxId: sandboxId || null,
            language: args.language,
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
        },
        null,
        2,
      );
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
  },
});

// Start the MCP server
server.start({
  transportType: "stdio",
});
