/**
 * Sandbox run-code command - Execute code in a sandbox
 * Supports streaming output with --stream flag
 */

import * as fs from "node:fs";
import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { getClient } from "../../lib/client-helper.js";

export default class SandboxRunCode extends Command {
  static override description = "Execute code in a sandbox";

  static override examples = [
    "<%= config.bin %> <%= command.id %> sb_12345 --language javascript --code \"console.log('hello')\"",
    "<%= config.bin %> <%= command.id %> sb_12345 --language python --file script.py --stream",
    '<%= config.bin %> <%= command.id %> sb_12345 -l typescript -c "const x: number = 1; console.log(x)" -s',
  ];

  static override args = {
    id: Args.string({
      description: "Sandbox ID",
      required: true,
    }),
  };

  static override flags = {
    language: Flags.string({
      char: "l",
      description: "Programming language (javascript, typescript, python)",
      required: true,
      options: ["javascript", "typescript", "python"],
    }),
    code: Flags.string({
      char: "c",
      description: "Code to execute (inline)",
      exclusive: ["file"],
    }),
    file: Flags.string({
      char: "f",
      description: "Path to code file to execute",
      exclusive: ["code"],
    }),
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
    const { args, flags } = await this.parse(SandboxRunCode);
    const client = getClient();

    // Get code from flag or file
    let code: string;
    if (flags.code) {
      code = flags.code;
    } else if (flags.file) {
      if (!fs.existsSync(flags.file)) {
        this.error(chalk.red(`File not found: ${flags.file}`));
      }
      code = fs.readFileSync(flags.file, "utf-8");
    } else {
      this.error(chalk.red("Either --code or --file must be provided"));
    }

    const language = flags.language as "javascript" | "typescript" | "python";

    if (flags.stream) {
      // Stream mode - output in real-time (with callbacks)
      this.log(chalk.cyan(`Running ${language} code (streaming)...\n`));

      try {
        const result = await client.sandbox.runCode(
          args.id,
          { language, code },
          {
            onStdout: (chunk: string) => process.stdout.write(`${chunk}\n`),
            onStderr: (chunk: string) => process.stderr.write(`${chalk.yellow(chunk)}\n`),
            onError: (error: unknown) => this.log(chalk.red(`Error: ${error}`)),
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
        spinner.start(`Running ${language} code...`);

        const result = await client.sandbox.runCode(args.id, { language, code });

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
