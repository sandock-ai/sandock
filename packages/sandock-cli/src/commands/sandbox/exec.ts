/**
 * Sandbox exec command - Execute code in a sandbox
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
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(SandboxExec);
    const client = getClient();
    const spinner = ora();

    try {
      spinner.start("Executing command...");

      const { data, error } = await client.POST("/api/sandbox/{id}/shell", {
        params: { path: { id: args.id } },
        body: {
          cmd: args.command,
          timeoutMs: flags.timeout * 1000, // Convert to milliseconds
        },
      });

      if (error || !data) {
        spinner.fail(chalk.red("Execution failed"));
        this.error(chalk.red(`Error: ${JSON.stringify(error)}`));
      }

      const result = data.data;

      if (typeof result === "object" && "stdout" in result) {
        spinner.succeed(chalk.green("Execution completed!"));

        this.log(chalk.bold("\nExecution Result:"));
        this.log(chalk.cyan("Exit Code:"), result.exitCode ?? "N/A");

        if (result.stdout) {
          this.log(chalk.bold("\nStdout:"));
          this.log(result.stdout);
        }

        if (result.stderr) {
          this.log(chalk.bold("\nStderr:"));
          this.log(chalk.yellow(result.stderr));
        }

        if (result.timedOut) {
          this.log(chalk.red("\n⚠ Execution timed out"));
        }

        this.log(chalk.gray(`\nExecution time: ${result.durationMs}ms`));
      } else {
        spinner.succeed(chalk.green("Command sent!"));
        this.log(chalk.gray("\nResult:"), JSON.stringify(result, null, 2));
      }
    } catch (error) {
      spinner.fail(chalk.red("Execution failed"));
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}
