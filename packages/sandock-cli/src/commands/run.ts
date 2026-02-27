/**
 * Run command — Create a sandbox from image and optionally enter interactive shell
 *
 * Usage:
 *   sandock run node:20-alpine --shell          # create + enter shell
 *   sandock run python:3.12 --shell --cmd python # create + python REPL
 *   sandock run ubuntu:24.04                     # create only (no shell)
 */

import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { getClient } from "../lib/client-helper.js";

export default class Run extends Command {
  static override description = "Create a sandbox from image and optionally enter shell";

  static override examples = [
    "<%= config.bin %> run node:20-alpine --shell",
    "<%= config.bin %> run python:3.12 --shell --cmd python",
    "<%= config.bin %> run ubuntu:24.04",
  ];

  static override args = {
    image: Args.string({
      description: "Docker image",
      required: true,
    }),
  };

  static override flags = {
    shell: Flags.boolean({
      description: "Enter interactive shell after creation",
      default: false,
    }),
    cmd: Flags.string({
      description: "Shell command",
      default: "/bin/sh",
    }),
    cpu: Flags.integer({
      char: "c",
      description: "CPU shares",
    }),
    memory: Flags.integer({
      char: "m",
      description: "Memory limit in MB",
    }),
    title: Flags.string({
      description: "Sandbox name",
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);
    const client = getClient();
    const spinner = ora();

    // 1. Create sandbox
    spinner.start(`Creating sandbox from ${args.image}...`);
    const result = await client.sandbox.create({
      image: args.image,
      ...(flags.cpu && { cpu: flags.cpu }),
      ...(flags.memory && { memory: flags.memory }),
      ...(flags.title && { title: flags.title }),
    });
    spinner.succeed(chalk.green(`Sandbox created: ${result.data.id}`));

    if (!flags.shell) {
      this.log(chalk.cyan(`\nTo enter shell: sandock sandbox shell ${result.data.id}`));
      return;
    }

    // 2. Enter interactive shell
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    this.log(chalk.cyan("Connecting to shell..."));

    try {
      const pty = await client.pty.create(result.data.id, {
        cols,
        rows,
        cmd: flags.cmd,
        onData: (data: Uint8Array) => {
          process.stdout.write(Buffer.from(data));
        },
        onExit: (exitCode: number | null) => {
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

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on("data", (data) => {
        pty.sendInput(data);
      });

      process.stdout.on("resize", () => {
        pty.resize(process.stdout.columns, process.stdout.rows);
      });

      await pty.wait();
    } catch (error) {
      this.error(
        chalk.red(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`),
      );
    }
  }
}
