/**
 * Tool: Write File
 *
 * Write text content to a file in the sandbox.
 * Use for creating scripts, config files, or text data.
 */

import { z } from "zod";
import type { ToolContext } from "../types/common.js";
import { formatResponse, getErrorMessage, getErrorStatus } from "../utils/error-helpers.js";

export const writeFileSchema = z.object({
  sandboxId: z.string().describe("The sandbox ID returned from sandock_create_sandbox"),
  path: z.string().describe("File path in the sandbox (e.g., '/workspace/script.py')"),
  content: z.string().describe("Text content to write to the file"),
  executable: z.boolean().optional().describe("Make the file executable (default: false)"),
});

export type WriteFileArgs = z.infer<typeof writeFileSchema>;

export async function writeFile(args: WriteFileArgs, context: ToolContext) {
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

    const { data, error } = await client.POST("/api/v1/sandbox/{id}/fs/write", {
      params: {
        path: { id: args.sandboxId },
      },
      body: {
        path: args.path,
        content: args.content,
        ...(args.executable !== undefined && { executable: args.executable }),
      },
    });

    if (error || !data) {
      const statusCode = getErrorStatus(error);
      const errorMessage = getErrorMessage(error);

      let errorType = "FILE_WRITE_FAILED";
      let solutions: string[] = [];
      let message = "Failed to write file";

      if (statusCode === 404) {
        errorType = "SANDBOX_NOT_FOUND";
        message = "Sandbox does not exist";
        solutions = [
          "Verify the sandboxId is correct",
          "Create a new sandbox with sandock_create_sandbox",
        ];
      } else if (statusCode === 400) {
        errorType = "INVALID_REQUEST";
        message = "Invalid file path or content";
        solutions = [
          "Check that the file path is valid",
          "Ensure the path is absolute (starts with /)",
          "Verify content is text (not binary)",
        ];
      } else if (statusCode === 401 || statusCode === 403) {
        errorType = "PERMISSION_DENIED";
        message = "Permission denied";
        solutions = ["Verify API key permissions", "Check sandbox ownership"];
      } else {
        solutions = [
          "Verify the file path is valid",
          "Check sandbox disk space",
          "Ensure parent directories exist or will be created",
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
          path: args.path,
          errorMessage,
        },
        solutions,
      });
    }

    return formatResponse({
      success: true,
      path: args.path,
      sandboxId: args.sandboxId,
      message: `File written successfully to ${args.path}`,
    });
  } catch (error) {
    return formatResponse({
      success: false,
      errorType: "INTERNAL_ERROR",
      error: "Unexpected error during file write",
      message: error instanceof Error ? error.message : String(error),
      sandboxId: args.sandboxId,
      solutions: ["Check network connectivity", "Retry the operation", "Check system logs"],
    });
  }
}
