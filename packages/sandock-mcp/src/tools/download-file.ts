/**
 * Tool: Download File
 *
 * Download a file from URL into the sandbox.
 * Use for importing user-uploaded files (ZIP, CSV, images).
 * File content never passes through agent, avoiding token consumption.
 */

import { z } from "zod";
import type { ToolContext } from "../types/common.js";
import { formatResponse, getErrorMessage, getErrorStatus } from "../utils/error-helpers.js";

export const downloadFileSchema = z.object({
  sandboxId: z.string().describe("The sandbox ID returned from sandock_create_sandbox"),
  url: z.string().describe("URL of the file to download"),
  targetPath: z.string().describe("Target file path in the sandbox (e.g., '/workspace/data.zip')"),
  timeout: z
    .number()
    .int()
    .positive()
    .default(60)
    .describe("Download timeout in seconds (default: 60, max: 300)"),
});

export type DownloadFileArgs = z.infer<typeof downloadFileSchema>;

export async function downloadFile(args: DownloadFileArgs, context: ToolContext) {
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

    // Try wget first
    let { data, error } = await client.POST("/api/sandbox/{id}/shell", {
      params: {
        path: { id: args.sandboxId },
      },
      body: {
        cmd: ["wget", "-O", args.targetPath, args.url],
        timeoutMs: maxTimeout * 1000,
      },
    });

    // If wget failed, try curl
    if (error || !data || data.data.exitCode !== 0) {
      const wgetError = error || data?.data.stderr;

      ({ data, error } = await client.POST("/api/sandbox/{id}/shell", {
        params: {
          path: { id: args.sandboxId },
        },
        body: {
          cmd: ["curl", "-L", "-o", args.targetPath, args.url],
          timeoutMs: maxTimeout * 1000,
        },
      }));

      // If curl also failed
      if (error || !data || data.data.exitCode !== 0) {
        const statusCode = getErrorStatus(error);
        const errorMessage = getErrorMessage(error);

        let errorType = "DOWNLOAD_FAILED";
        let solutions: string[] = [];
        let message = "Failed to download file";

        if (statusCode === 404) {
          errorType = "SANDBOX_NOT_FOUND";
          message = "Sandbox does not exist";
          solutions = [
            "Verify the sandboxId is correct",
            "Create a new sandbox with sandock_create_sandbox",
          ];
        } else if (statusCode === 408 || statusCode === 504) {
          errorType = "DOWNLOAD_TIMEOUT";
          message = "Download timed out";
          solutions = [
            `Increase timeout (current: ${args.timeout}s, max: 300s)`,
            "Check if the URL is accessible",
            "Try a smaller file or split the download",
          ];
        } else {
          solutions = [
            "Verify the URL is accessible and correct",
            "Check if the file exists at the URL",
            "Ensure the URL supports direct downloads (not requires auth)",
            "Check sandbox network connectivity",
            `wget error: ${wgetError}`,
            `curl error: ${data?.data.stderr || errorMessage}`,
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
            url: args.url,
            targetPath: args.targetPath,
            wgetStderr: wgetError,
            curlStderr: data?.data.stderr,
            errorMessage,
          },
          solutions,
        });
      }
    }

    // Verify file was downloaded by checking if it exists
    const { data: verifyData } = await client.POST("/api/sandbox/{id}/shell", {
      params: {
        path: { id: args.sandboxId },
      },
      body: {
        cmd: ["test", "-f", args.targetPath],
        timeoutMs: 5000,
      },
    });

    if (verifyData?.data.exitCode !== 0) {
      return formatResponse({
        success: false,
        errorType: "FILE_NOT_FOUND",
        error: "Download completed but file not found",
        message: "The download command succeeded but the file was not created",
        solutions: [
          "Check if the URL returns a valid file",
          "Verify the target path is correct",
          "Check sandbox disk space",
        ],
      });
    }

    // Get file size
    const { data: sizeData } = await client.POST("/api/sandbox/{id}/shell", {
      params: {
        path: { id: args.sandboxId },
      },
      body: {
        cmd: ["stat", "-c", "%s", args.targetPath],
        timeoutMs: 5000,
      },
    });

    const fileSize = sizeData?.data.stdout ? parseInt(sizeData.data.stdout.trim()) : undefined;

    return formatResponse({
      success: true,
      path: args.targetPath,
      sandboxId: args.sandboxId,
      url: args.url,
      ...(fileSize && { sizeBytes: fileSize }),
      message: `File downloaded successfully to ${args.targetPath}`,
    });
  } catch (error) {
    return formatResponse({
      success: false,
      errorType: "INTERNAL_ERROR",
      error: "Unexpected error during file download",
      message: error instanceof Error ? error.message : String(error),
      sandboxId: args.sandboxId,
      solutions: ["Check network connectivity", "Retry the operation", "Verify URL is valid"],
    });
  }
}
