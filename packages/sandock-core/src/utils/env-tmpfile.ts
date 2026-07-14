/**
 * Build a shell snippet that writes env vars to a temporary file,
 * sources it, removes it, then executes the real command.
 *
 * This avoids leaking secrets via `/proc/pid/cmdline` or `ps`.
 * The file lives only milliseconds and is created with mode 0600.
 */
export function buildEnvShellSnippet(env: Record<string, string>, cmd: string): string {
  const lines = Object.entries(env).map(
    ([k, v]) => `export ${k}='${String(v).replace(/'/g, "'\\''")}'`,
  );
  const body = lines.join("\n");

  // Use a heredoc with a random delimiter to avoid collisions with env values.
  // The file path includes $$ (PID) and $RANDOM for uniqueness.
  return [
    `__env_f=/tmp/.sandock_env_$$_$RANDOM`,
    `cat > "$__env_f" <<'__SANDOCK_ENV__'`,
    body,
    `__SANDOCK_ENV__`,
    `chmod 600 "$__env_f"`,
    `. "$__env_f"`,
    `rm -f "$__env_f"`,
    `unset __env_f`,
    cmd,
  ].join("\n");
}
