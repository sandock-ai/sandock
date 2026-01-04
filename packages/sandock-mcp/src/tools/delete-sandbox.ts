/**
 * Tool: Delete Sandbox
 *
 * Delete a sandbox and free resources.
 * Always call this when done to prevent resource leaks.
 */

import { z } from "zod";
import type { ToolContext } from "../types/common.js";
import { formatResponse, getErrorMessage, getErrorStatus } from "../utils/error-helpers.js";

export const deleteSandboxSchema = z.object({
  sandboxId: z.string().describe("The sandbox ID to delete"),
});

export type DeleteSandboxArgs = z.infer<typeof deleteSandboxSchema>;

export async function deleteSandbox(args: DeleteSandboxArgs, context: ToolContext) {
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

    const { data, error } = await client.DELETE("/api/v1/sandbox/{id}", {
      params: {
        path: { id: args.sandboxId },
      },
    });

    if (error || !data) {
      const statusCode = getErrorStatus(error);
      const errorMessage = getErrorMessage(error);

      let errorType = "DELETION_FAILED";
      let solutions: string[] = [];
      let message = "Failed to delete sandbox";

      if (statusCode === 404) {
        // Sandbox not found is actually a success case - it's already gone
        return formatResponse({
          success: true,
          sandboxId: args.sandboxId,
          message: "Sandbox not found (may have been already deleted)",
          alreadyDeleted: true,
        });
      } else if (statusCode === 401 || statusCode === 403) {
        errorType = "PERMISSION_DENIED";
        message = "Permission denied";
        solutions = [
          "Verify API key permissions",
          "Check if you own this sandbox",
          "Ensure the API key has 'sandbox:delete' permissions",
        ];
      } else {
        solutions = [
          "Verify the sandboxId is correct",
          "Check Sandock API connectivity",
          "Retry the deletion",
          "Check if sandbox is in a deletable state",
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
          errorMessage,
        },
        solutions,
      });
    }

    return formatResponse({
      success: true,
      sandboxId: args.sandboxId,
      message: "Sandbox deleted successfully",
    });
  } catch (error) {
    return formatResponse({
      success: false,
      errorType: "INTERNAL_ERROR",
      error: "Unexpected error during sandbox deletion",
      message: error instanceof Error ? error.message : String(error),
      sandboxId: args.sandboxId,
      solutions: [
        "Check network connectivity",
        "Retry the deletion",
        "If the issue persists, the sandbox may auto-expire",
      ],
    });
  }
}
