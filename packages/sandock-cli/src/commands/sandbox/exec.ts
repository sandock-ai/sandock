/**
 * Sandbox exec command - Execute a command in a sandbox
 * Supports streaming output with --stream flag
 */

import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { getClient } from "../../lib/client-helper.js";

export default class SandboxExec extends Command {
  static override description = "Execute a command in a sandbox";

  static override examples = [
    '<%= config.bin %> <%= command.id %> sb_12345 "node -v"',
    '<%= config.bin %> <%= command.id %> sb_12345 "python script.py" --timeout 60',
    '<%= config.bin %> <%= command.id %> sb_12345 "echo hello; sleep 1; echo world" --stream',
  ];

  static override args = {
    id: Args.string({
      description: "Sandbox ID",
      required: true,
    }),
    command: Args.string({
      description: "Command to execute",
      required: true,
    }),
  };

  static override flags = {
    timeout: Flags.integer({
      char: "t",
      description: "Execution timeout in seconds",
      default: 30,
    }),
    stream: Flags.boolean({
      char: "s",
      description: "Stream output in real-time",
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(SandboxExec);
    const client = getClient();

    if (flags.stream) {
      // Stream mode - output in real-time (with callbacks)
      this.log(chalk.cyan("Executing command (streaming)...\n"));

      try {
        const result = await client.sandbox.shell(
          args.id,
          { cmd: args.command, timeoutMs: flags.timeout * 1000 },
          {
            onStdout: (chunk: string) => process.stdout.write(`${chunk}\n`),
            onStderr: (chunk: string) => process.stderr.write(`${chalk.yellow(chunk)}\n`),
          },
        );

        this.log(chalk.gray(`\n─────────────────────────────────`));
        this.log(chalk.cyan("Exit Code:"), result.data.exitCode);
        this.log(chalk.gray(`Execution time: ${result.data.durationMs}ms`));

        if (result.data.timedOut) {
          this.log(chalk.red("⚠ Execution timed out"));
        }
      } catch (error) {
        this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    } else {
      // Batch mode - show spinner and display output at the end
      const spinner = ora();

      try {
        spinner.start("Executing command...");

        const result = await client.sandbox.shell(args.id, {
          cmd: args.command,
          timeoutMs: flags.timeout * 1000,
        });

        spinner.succeed(chalk.green("Execution completed!"));

        this.log(chalk.bold("\nExecution Result:"));
        this.log(chalk.cyan("Exit Code:"), result.data.exitCode ?? "N/A");

        if (result.data.stdout) {
          this.log(chalk.bold("\nStdout:"));
          this.log(result.data.stdout);
        }

        if (result.data.stderr) {
          this.log(chalk.bold("\nStderr:"));
          this.log(chalk.yellow(result.data.stderr));
        }

        if (result.data.timedOut) {
          this.log(chalk.red("\n⚠ Execution timed out"));
        }

        this.log(chalk.gray(`\nExecution time: ${result.data.durationMs}ms`));
      } catch (error) {
        spinner.fail(chalk.red("Execution failed"));
        this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }
}
