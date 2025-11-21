/**
 * Error handling utilities
 */

/**
 * Safely extract HTTP status code from error object
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errorObj = error as Record<string, unknown>;
  return (errorObj.status ?? errorObj.statusCode) as number | undefined;
}

/**
 * Safely extract error message from error object
 */
export function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errorObj = error as Record<string, unknown>;
  return errorObj.message as string | undefined;
}

/**
 * Format tool response as JSON string
 */
export function formatResponse(response: unknown): string {
  return JSON.stringify(response, null, 2);
}
