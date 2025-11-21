/**
 * Tool: Shell Exec
 *
 * Execute shell commands in the sandbox.
 * Use for file operations, system commands, or running tools.
 */

import { z } from "zod";
import type { ToolContext } from "../types/common.js";
import { formatResponse, getErrorMessage, getErrorStatus } from "../utils/error-helpers.js";

export const shellExecSchema = z.object({
  sandboxId: z.string().describe("The sandbox ID returned from sandock_create_sandbox"),
  command: z
    .union([z.string(), z.array(z.string())])
    .describe(
      'Shell command to execute. Can be a string ("ls -la") or array (["bash", "-c", "ls"])',
    ),
  workdir: z
    .string()
    .optional()
    .describe("Working directory for command execution (default: sandbox root)"),
  timeout: z
    .number()
    .int()
    .positive()
    .default(30)
    .describe("Execution timeout in seconds (default: 30, max: 300)"),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe("Environment variables for the command"),
});

export type ShellExecArgs = z.infer<typeof shellExecSchema>;

export async function shellExec(args: ShellExecArgs, context: ToolContext) {
  const { client, apiKey } = context;

  try {
    if (!apiKey) {
      return formatResponse({
        success: false,
        errorType: "CONFIGURATION_ERROR",
        error: "Sandock API key is not configured",
        message: "The SANDOCK_API_KEY environment variable is required",
      });
    }

    const maxTimeout = Math.min(args.timeout, 300);

    const { data, error } = await client.POST("/api/sandbox/{id}/shell", {
      params: {
        path: { id: args.sandboxId },
      },
      body: {
        cmd: args.command,
        timeoutMs: maxTimeout * 1000,
        ...(args.workdir && { workdir: args.workdir }),
        ...(args.env && { env: args.env }),
      },
    });

    if (error || !data) {
      const statusCode = getErrorStatus(error);
      const errorMessage = getErrorMessage(error);

      let errorType = "SHELL_EXECUTION_FAILED";
      let solutions: string[] = [];
      let message = "Failed to execute shell command";

      if (statusCode === 404) {
        errorType = "SANDBOX_NOT_FOUND";
        message = "Sandbox does not exist or was already deleted";
        solutions = [
          "Verify the sandboxId is correct",
          "Check if the sandbox was deleted",
          "Create a new sandbox with sandock_create_sandbox",
        ];
      } else if (statusCode === 408 || statusCode === 504) {
        errorType = "EXECUTION_TIMEOUT";
        message = "Command execution timed out";
        solutions = [
          `Increase timeout (current: ${args.timeout}s, max: 300s)`,
          "Optimize the command to run faster",
          "Break long operations into smaller steps",
        ];
      } else if (statusCode === 401 || statusCode === 403) {
        errorType = "PERMISSION_DENIED";
        message = "Permission denied";
        solutions = ["Verify API key permissions", "Check sandbox ownership"];
      } else {
        solutions = [
          "Verify the command syntax is correct",
          "Check if required tools are available in the sandbox",
          "Review stderr output for specific errors",
        ];
      }

      return formatResponse({
        success: false,
        errorType,
        error,
        message,
        details: {
          statusCode,
          sandboxId: args.sandboxId,
          command: args.command,
          errorMessage,
        },
        solutions,
      });
    }

    const result = data.data;

    return formatResponse({
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      sandboxId: args.sandboxId,
      ...(result.exitCode !== 0 && {
        executionFailed: true,
        troubleshooting: [
          "Check stderr for error details",
          "Verify command syntax and arguments",
          "Ensure required files/tools exist in sandbox",
        ],
      }),
    });
  } catch (error) {
    return formatResponse({
      success: false,
      errorType: "INTERNAL_ERROR",
      error: "Unexpected error during shell execution",
      message: error instanceof Error ? error.message : String(error),
      sandboxId: args.sandboxId,
      solutions: ["Check network connectivity", "Retry the operation", "Check system logs"],
    });
  }
}
