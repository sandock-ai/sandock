/**
 * Sandbox shell command — Open an interactive PTY shell in a sandbox
 *
 * Usage:
 *   sandock sandbox shell <sandbox-id>             # default /bin/sh
 *   sandock sandbox shell <sandbox-id> --cmd zsh   # custom shell
 */

import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { getClient } from "../../lib/client-helper.js";

export default class SandboxShell extends Command {
  static override description = "Open interactive shell in a sandbox (PTY)";

  static override examples = [
    "<%= config.bin %> sandbox shell sb_12345",
    '<%= config.bin %> sandbox shell sb_12345 --cmd "/bin/bash"',
    "<%= config.bin %> sandbox shell sb_12345 --cmd python",
  ];

  static override args = {
    id: Args.string({
      description: "Sandbox ID",
      required: true,
    }),
  };

  static override flags = {
    cmd: Flags.string({
      description: "Shell command to execute",
      default: "/bin/sh",
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(SandboxShell);
    const client = getClient();

    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    this.log(chalk.cyan(`Connecting to sandbox ${args.id}...`));

    try {
      const pty = await client.pty.create(args.id, {
        cols,
        rows,
        cmd: flags.cmd,
        onData: (data: Uint8Array) => {
          process.stdout.write(Buffer.from(data));
        },
        onExit: (exitCode: number | null) => {
          // Restore terminal
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdin.pause();
          this.log(chalk.gray(`\nSession ended (exit code: ${exitCode})`));
          process.exit(exitCode ?? 0);
        },
        onError: (err: Error) => {
          this.log(chalk.red(`Error: ${err.message}`));
        },
      });

      this.log(chalk.green(`Connected! (session: ${pty.sessionId})`));
      this.log(chalk.gray("Press Ctrl+D to exit.\n"));

      // Enter raw mode — send keystrokes directly, no line buffering / local echo
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on("data", (data) => {
        pty.sendInput(data);
      });

      // Forward terminal resize events
      process.stdout.on("resize", () => {
        pty.resize(process.stdout.columns, process.stdout.rows);
      });

      // Wait for PTY to close
      await pty.wait();
    } catch (error) {
      this.error(
        chalk.red(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`),
      );
    }
  }
}
