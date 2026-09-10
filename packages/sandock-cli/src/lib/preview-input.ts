/** Validate values before interpolating them into SDK request paths. */
export function validateSandboxId(id: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
    throw new Error("Invalid sandbox ID: use only letters, numbers, underscores, and hyphens");
  }
}

export function validatePreviewToken(token: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("Invalid Preview token: use only letters, numbers, underscores, and hyphens");
  }
}
